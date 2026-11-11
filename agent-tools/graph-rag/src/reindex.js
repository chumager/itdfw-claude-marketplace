#!/usr/bin/env node
// Usage: itdfw-graph-rag-index [path/to/graph.json]   (default: GRAPH_JSON, or graphify-out/graph.json)
import {reindex, config} from "./index.js";

const graph = process.argv[2] ?? config.graph;

console.log(`grafo:      ${graph}`);
console.log(`qdrant:     ${config.qdrant} · colección ${config.collection}`);
console.log(`embedding:  ${config.model} (${config.size}) · tipos ${config.types.join(",")}`);

const {count} = await reindex({
  graph,
  onProgress: (n, t) => process.stdout.write(`\r  ${n}/${t}`)
});
console.log(`\nlisto: ${count} nodos indexados`);
