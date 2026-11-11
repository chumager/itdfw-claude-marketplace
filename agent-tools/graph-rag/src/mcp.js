#!/usr/bin/env node
import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {CallToolRequestSchema, ListToolsRequestSchema} from "@modelcontextprotocol/sdk/types.js";
// namespace y no named imports: los handlers se llaman igual que las funciones y se sombrearían
// entre sí (un `async status()` llamando a `status()` es recursión infinita, no la del módulo).
import * as rag from "./index.js";
import * as gaps from "./gaps.js";

const {config} = rag;

const FIND_DESC = `Busca en el grafo de conocimiento del framework ITDFW qué pieza YA resuelve un problema, ANTES de implementar nada. El FW tiene años de madurez: casi siempre la pieza existe.

Es un paso INTERMEDIO: no te da la respuesta, te dice DÓNDE BUSCAR. Después lees el archivo.

🔴 CÓMO SE CONSULTA — tres niveles, medidos:

  ❌ PROSA: "necesito que dos procesos no hagan lo mismo a la vez"
     → basura. El índice no traduce del problema a la solución.

  ⚠️ TÉCNICO CON RELLENO: "SSE stream por entidad suscripción canal notificación"
     → falla igual. Las palabras de relleno arrastran el vector a otro dominio,
       aunque cada una sea técnica.

  ✅ LA API REAL, SIN RELLENO: "SSEHub broadcast pubsub"
     → top-1. También: "mutex lock semáforo exclusión mutua", "safeClone safeCopy schema derivado".

Nombrá clases, métodos y módulos como se llaman en el código. Cuantas menos palabras de pegamento, mejor.

🔴 MIRÁ EL SCOPE del resultado antes de usarlo. Cada línea viene marcada:

  [BACK] [FRONT] [LIB] [PLUG]  el código, por lado. El mismo concepto existe en los dos:
                               \`$sse\` en fronts/ es el plugin Vue; \`libs/sse\` es el hub del servidor.
                               Un resultado del lado equivocado se ve como acierto y no lo es.

  [DOC]                        documentación vigente.

  [LEGACY]                     🔴 documentación MUERTA que ya no refleja el código.
                               NO decidas con eso. Caso real: alguien leyó documentación vieja creyéndola
                               vigente y recomendó la variante equivocada de mutex.

Devuelve conceptos con el archivo donde viven, para ir a leerlos.`;

const REINDEX_DESC = `Regenera el índice desde el grafo de graphify. VACÍA y reconstruye — no es incremental, porque el grafo es una fuente ajena que puede cambiar de raíz entre corridas.

Correlo después de cada actualización de graphify. Si find avisa que el índice está desactualizado, es esto lo que hay que correr.`;

const STATUS_DESC = `Estado del índice: si Qdrant responde, si la colección existe, cuántos conceptos tiene y si quedó desactualizado respecto del grafo. Devuelve qué hacer si algo falta.`;

const START_DESC = `Levanta el servicio de Qdrant, SOLO si está configurado como local.

La configuración del MCP dice si se puede: cuando trae un comando de arranque, el servicio es local y esta herramienta lo ejecuta. Cuando no lo trae, es un servicio remoto y no hay nada que levantar desde acá — en ese caso hay que reportar que no responde, no insistir.

Avisá siempre que lo levantaste.`;

const GAP_DESC = `Declara que buscaste algo y el índice NO te sirvió. Es lo que hace que el sistema mejore: sin esto, el mismo hueco lo vuelve a sufrir el próximo.

🔴 Describe la necesidad en TUS PALABRAS, en lenguaje de intención — no en jerga. Justamente el vocabulario que hoy no encuentra es el que hay que capturar.

  need:    "necesitaba avisarle algo a todos los workers al mismo tiempo"
  queries: ["broadcast workers", "notificar todos los procesos"]
  got:     "trajo documentos de un tema que no tiene nada que ver"

Repórtalo cuando: no salió nada útil, salió del scope equivocado (front por back), o te sirvió tan poco que igual tuviste que ir a leer el código a ciegas.

Un gap que ya existía suma una repetición y, si estaba cerrado, se REABRE — que alguien lo sufra dos veces es la señal de que el arreglo no funcionó.`;

const GAPS_DESC = `Lista los huecos declarados: qué se buscó y no se encontró. Sin argumentos entrega los ABIERTOS, ordenados por cuántas veces se repitieron.

🔴 Se lee ANTES de actualizar el grafo. Cada gap dice qué información le faltó al grafo anterior; con esa lista, la nueva pasada se hace con foco en vez de a ciegas.

Cómo se resuelve un gap: buscar el concepto en el código (grep/rg/serena), leerlo, y DOCUMENTARLO. Al documentar cambia el archivo, y recién ahí el \`--update\` de graphify tiene algo que re-extraer. Un gap no se cierra editando el grafo: se cierra escribiendo lo que faltaba.`;

const CLOSE_DESC = `Cierra un gap resuelto (o lo descarta con \`discard: true\`). No borra: el histórico es lo que permite detectar que un hueco REAPARECE, que es la señal de que la solución anterior no sirvió.`;

const server = new Server({name: "itdfw-graph-rag", version: "0.1.0"}, {capabilities: {tools: {}}});

const tool = (name, description, props = {}, required = []) => ({
  name,
  description,
  inputSchema: {type: "object", properties: props, required}
});

// The gaps feature is opt-in: its three tools exist only when GAPS_DB is set (listed below, and refused in the call
// handler otherwise). The database itself is opened by gaps.js on the first call to one of them, never at start.
const GAP_TOOL_NAMES = ["reportGap", "gaps", "closeGap"];
const GAP_TOOLS = gaps.enabled()
  ? [
      tool(
        "reportGap",
        GAP_DESC,
        {
          need: {type: "string", description: "Qué necesitabas, en lenguaje de intención"},
          queries: {type: "array", items: {type: "string"}, description: "Qué consultas probaste"},
          got: {type: "string", description: "Qué te devolvió, o por qué no sirvió"}
        },
        ["need"]
      ),
      tool("gaps", GAPS_DESC, {all: {type: "boolean", description: "Incluir cerrados y descartados"}}),
      tool(
        "closeGap",
        CLOSE_DESC,
        {
          id: {type: "number", description: "Id del gap"},
          resolution: {type: "string", description: "Qué se hizo para resolverlo"},
          discard: {type: "boolean", description: "Descartar en vez de resolver"}
        },
        ["id"]
      )
    ]
  : [];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    tool(
      "find",
      FIND_DESC,
      {
        query: {type: "string", description: "Términos técnicos que nombran la capacidad buscada"},
        limit: {type: "number", description: "Cuántos resultados (default 8)"}
      },
      ["query"]
    ),
    tool("reindex", REINDEX_DESC),
    tool("status", STATUS_DESC),
    tool("start", START_DESC),
    ...GAP_TOOLS
  ]
}));

const texto = t => ({content: [{type: "text", text: t}]});

const HANDLERS = {
  async status() {
    const s = await rag.status();
    return texto(
      [
        `ollama:     ${s.ollama ? `✅ ${config.model}` : "🔴 no disponible"}`,
        `qdrant:     ${s.qdrant ? "✅ arriba" : "🔴 no responde"} (${config.qdrant})`,
        `colección:  ${s.collection ? `✅ ${config.collection} · ${s.points} conceptos` : "🔴 no existe"}`,
        s.graph && `grafo:      ${s.graph}`,
        s.indexed && `indexado:   ${s.indexed}${s.stale ? "  ← DESACTUALIZADO" : ""}`,
        s.hint && `\n👉 ${s.hint}`
      ]
        .filter(Boolean)
        .join("\n")
    );
  },
  async start() {
    if ((await rag.status()).qdrant) return texto(`✅ Qdrant ya estaba arriba en ${config.qdrant}`);
    const r = await rag.start();
    if (r.remote)
      return texto(
        `🔴 No hay comando de arranque configurado: ${config.qdrant} es un servicio REMOTO. No hay nada que levantar desde acá — reportá que no responde.`
      );
    return texto(r.ok ? `✅ Levantado con \`${r.cmd}\` — ya responde en ${config.qdrant}` : `🔴 Falló \`${r.cmd}\`: ${r.error}`);
  },
  async reindex() {
    const s = await rag.status();
    if (!s.qdrant) return texto(`🔴 ${s.hint}`);
    const {count, commit} = await rag.reindex();
    return texto(`✅ ${count} conceptos indexados${commit ? ` (grafo del commit ${commit.slice(0, 8)})` : ""}`);
  },
  async reportGap({need, queries, got}) {
    const r = gaps.report({need, queries, got});
    const s = gaps.stats();
    return texto(
      [
        r.reabierto
          ? `⚠️ Gap #${r.id} REABIERTO — ya se había dado por resuelto y volvió a aparecer (${r.hits}ª vez). El arreglo anterior no sirvió.`
          : r.reincidente
            ? `⚠️ Gap #${r.id} REINCIDENTE — ${r.hits}ª vez que alguien busca esto sin encontrarlo.`
            : `✅ Gap #${r.id} registrado.`,
        `abiertos: ${s.abiertos}${s.reincidentes ? ` (${s.reincidentes} reincidentes)` : ""}`
      ].join("\n")
    );
  },
  async gaps({all} = {}) {
    const filas = gaps.list({all});
    if (!filas.length) return texto(all ? "sin gaps registrados" : "✅ sin gaps abiertos");
    const s = gaps.stats();
    return texto(
      `${filas.length} gap(s) · abiertos ${s.abiertos} · resueltos ${s.resueltos} · descartados ${s.descartados}\n\n` +
        filas
          .map(g =>
            [
              `#${g.id} [${g.status}]${g.hits > 1 ? ` ⚠️ ${g.hits}× ` : " "}${g.need}`,
              `     probé: ${g.queries}`,
              g.got && `     obtuve: ${g.got}`,
              g.resolution && `     resolución: ${g.resolution}`
            ]
              .filter(Boolean)
              .join("\n")
          )
          .join("\n\n")
    );
  },
  async closeGap({id, resolution, discard}) {
    const ok = discard ? gaps.discard(id, resolution) : gaps.close(id, resolution);
    return texto(ok ? `✅ Gap #${id} ${discard ? "descartado" : "resuelto"}` : `🔴 no existe el gap #${id}`);
  },
  async find({query, limit}) {
    const s = await rag.status();
    if (!s.ollama || !s.qdrant || !s.collection || s.points === 0) return texto(`🔴 ${s.hint}`);
    const hits = await rag.find(query, limit ?? 8);
    const aviso = s.stale ? "⚠️ el índice está desactualizado respecto del grafo — considerá reindex\n\n" : "";
    if (!hits.length) return texto(`${aviso}sin resultados — probá con otros términos técnicos o sinónimos`);
    // Una fuente muerta con el mismo aspecto que una viva induce al error CON confianza: peor que
    // no encontrar nada. Y el scope separa front de back, donde el mismo concepto existe dos veces.
    const LEGACY = /^(claude-context\/|docs\/)|\.(bak|old)(\/|$)|\.backup(\/|$)|\.old(\/|$)/;
    const scope = f =>
      LEGACY.test(f)
        ? "LEGACY"
        : /^fronts\//.test(f)
          ? "FRONT "
          : /^back\//.test(f)
            ? "BACK  "
            : /^libs\//.test(f)
              ? "LIB   "
              : /^plugins\//.test(f)
                ? "PLUG  "
                : "DOC   ";
    const hayLegacy = hits.some(h => LEGACY.test(h.file ?? ""));
    const nota = hayLegacy
      ? "\n\n⚠️ Hay resultados marcados [LEGACY]: documentación vieja que ya no refleja el código. No decidas con eso — contrástalo contra la fuente vigente."
      : "";
    return texto(aviso + hits.map(h => `${h.score}  [${scope(h.file ?? "")}] ${h.label}\n      → ${h.file}`).join("\n") + nota);
  }
};

server.setRequestHandler(CallToolRequestSchema, async ({params}) => {
  const handler = HANDLERS[params.name];
  if (!handler || (!gaps.enabled() && GAP_TOOL_NAMES.includes(params.name))) throw new Error(`herramienta desconocida: ${params.name}`);
  try {
    return await handler(params.arguments ?? {});
  } catch (err) {
    return texto(`🔴 ${err.message}`);
  }
});

await server.connect(new StdioServerTransport());
