import {readFileSync, writeFileSync, statSync, existsSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import ollama from "ollama";

export const config = {
  graph: process.env.GRAPH_JSON ?? "graphify-out/graph.json",
  qdrant: process.env.QDRANT_URL ?? "http://localhost:6343",
  collection: process.env.COLLECTION ?? "graph",
  model: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
  size: Number(process.env.EMBEDDING_SIZE ?? 768),
  apiKey: process.env.QDRANT_API_KEY ?? null,
  // 🔴 La PRESENCIA de este comando es la señal de que el servicio es LOCAL y hay algo que levantar.
  // Sin él se asume remoto: no hay nada que arrancar, solo reportar que no responde.
  startCmd: process.env.QDRANT_START_CMD ?? null,
  // concept = ideas destiladas por graphify · rationale = el "por qué" de los comentarios.
  // document and code nodes are left out by default: they add noise to the retrieval (measured).
  types: (process.env.NODE_TYPES ?? "concept,rationale").split(",")
};

/**
 * Where the state of an index is kept: next to the graph it was built from, so two graphs (or a read-only install of
 * this package) never share or fight over one file.
 * @param {string} graph - Path of the graph file.
 * @returns {string} Path of the `.index-meta.json` that belongs to that graph.
 */
export const metaFile = graph => join(dirname(resolve(graph)), ".index-meta.json");

// nomic distingue el ROL del texto por prefijo. Sin esto los scores se aplanan y deja de discriminar.
const asDoc = t => `search_document: ${t}`;
const asQuery = t => `search_query: ${t}`;

export const embed = async input => (await ollama.embed({model: config.model, input})).embeddings;

const headers = () => ({
  "content-type": "application/json",
  ...(config.apiKey ? {"api-key": config.apiKey} : {})
});

export async function qdrant(method, path, body) {
  const res = await fetch(`${config.qdrant}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`qdrant ${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

/**
 * Solo tiene sentido si hay startCmd — o sea si el servicio es local.
 * El comando sale de la config del MCP, no de input de nadie: quien la escribe ya decide qué
 * binario corre el server. Por eso va por shell, para admitir cualquier forma de arranque.
 */
export async function start() {
  if (!config.startCmd) return {ok: false, remote: true};
  const {promisify} = await import("node:util");
  const exec = promisify((await import("node:child_process")).exec);
  try {
    await exec(config.startCmd);
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if ((await status()).qdrant) return {ok: true, cmd: config.startCmd};
    }
    return {ok: false, cmd: config.startCmd, error: "arrancó pero no respondió en 15s"};
  } catch (err) {
    return {ok: false, cmd: config.startCmd, error: err.message};
  }
}

/**
 * El embedding es la otra mitad del servicio y falla distinto: ollama puede estar arriba pero SIN el
 * modelo. Sin este chequeo, `find` revienta con un error de librería en vez de decir qué falta.
 */
export async function checkOllama() {
  try {
    const r = await fetch(`${ollama.config?.host ?? "http://127.0.0.1:11434"}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });
    if (!r.ok) return {ok: false, hint: "Ollama responde con error. Verificá el servicio."};
    const {models = []} = await r.json();
    const tiene = models.some(m => (m.name ?? "").startsWith(config.model));
    return tiene
      ? {ok: true, models: models.length}
      : {ok: false, hint: `Ollama está arriba pero le falta el modelo. Corré: ollama pull ${config.model}`};
  } catch {
    return {ok: false, hint: "Ollama no responde. Levantá el servicio (`ollama serve`) antes de consultar."};
  }
}

/**
 * State of the whole stack: embedding service, vector database, collection, and whether the index is older than the
 * graph. The graph is a foreign source of truth that graphify regenerates and can change substantially, so the graph's
 * modification time is compared with the one saved at the last indexing (in `.index-meta.json` next to the graph): a
 * stale index lies silently.
 * @returns {Promise<Object>} `{qdrant, collection, points, stale, graph, indexed, ollama, hint?}`; `hint` says what to do
 * when something is missing.
 */
export async function status() {
  const out = {qdrant: false, collection: false, points: 0, stale: null, graph: null, indexed: null, ollama: false};
  const o = await checkOllama();
  out.ollama = o.ok;
  out.ollamaHint = o.hint;
  try {
    const r = await fetch(`${config.qdrant}/collections`, {headers: headers(), signal: AbortSignal.timeout(3000)});
    out.qdrant = r.ok;
  } catch {
    return {
      ...out,
      local: !!config.startCmd,
      hint: config.startCmd
        ? `Qdrant no responde en ${config.qdrant}. Es LOCAL: podés levantarlo con la herramienta start (corre \`${config.startCmd}\`).`
        : `Qdrant no responde en ${config.qdrant}. No hay comando de arranque configurado, así que es un servicio REMOTO: no hay nada que levantar desde acá — reportalo.`
    };
  }
  try {
    const {result} = await qdrant("GET", `/collections/${config.collection}`);
    out.collection = true;
    out.points = result.points_count ?? 0;
  } catch {
    return {...out, hint: `La colección "${config.collection}" no existe. Corré la herramienta reindex.`};
  }
  if (existsSync(config.graph)) out.graph = statSync(config.graph).mtime.toISOString();
  const meta = metaFile(config.graph);
  if (existsSync(meta)) {
    const m = JSON.parse(readFileSync(meta, "utf8"));
    out.indexed = m.indexedAt;
    out.stale = m.graphMtime !== out.graph;
  }
  if (!out.ollama) out.hint = out.ollamaHint;
  else if (out.points === 0) out.hint = "La colección está vacía. Corré reindex.";
  else if (out.stale) out.hint = "🔴 El grafo cambió después del último indexado. Corré reindex.";
  return out;
}

export function leerNodos(file = config.graph) {
  const g = JSON.parse(readFileSync(file, "utf8"));
  return {
    nodos: g.nodes.filter(n => config.types.includes(n.file_type) && n.label),
    commit: g.built_at_commit ?? null
  };
}

/**
 * Empties the collection and rebuilds it from the graph. It is not incremental on purpose: the graph can change from
 * the root between runs.
 * @param {{onProgress?: (done: number, total: number) => void, graph?: string}} [options] - `graph` is the path of the
 * graph file to index (default `config.graph`, i.e. `GRAPH_JSON`); the index state is written next to it.
 * @returns {Promise<{count: number, commit: string|null}>} Nodes indexed and the commit the graph was built at.
 */
export async function reindex({onProgress, graph = config.graph} = {}) {
  const {nodos, commit} = leerNodos(graph);
  // not qdrant(): a collection that does not exist yet answers 404 here and that is fine
  await fetch(`${config.qdrant}/collections/${config.collection}`, {method: "DELETE", headers: headers()});
  await qdrant("PUT", `/collections/${config.collection}`, {vectors: {size: config.size, distance: "Cosine"}});
  for (let i = 0; i < nodos.length; i += 64) {
    const lote = nodos.slice(i, i + 64);
    const vectors = await embed(lote.map(n => asDoc(n.label)));
    await qdrant("PUT", `/collections/${config.collection}/points?wait=true`, {
      points: lote.map((n, j) => ({
        id: i + j,
        vector: vectors[j],
        payload: {label: n.label, file: n.source_file, type: n.file_type, community: n.community}
      }))
    });
    onProgress?.(Math.min(i + 64, nodos.length), nodos.length);
  }
  writeFileSync(
    metaFile(graph),
    JSON.stringify({
      indexedAt: new Date().toISOString(),
      graphMtime: existsSync(graph) ? statSync(graph).mtime.toISOString() : null,
      commit,
      count: nodos.length
    })
  );
  return {count: nodos.length, commit};
}

export async function find(query, limit = 8) {
  const [vector] = await embed(asQuery(query));
  const {result} = await qdrant("POST", `/collections/${config.collection}/points/search`, {
    vector,
    limit,
    with_payload: true
  });
  return result.map(r => ({score: +r.score.toFixed(3), ...r.payload}));
}
