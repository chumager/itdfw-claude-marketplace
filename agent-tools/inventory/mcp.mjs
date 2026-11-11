#!/usr/bin/env node
// Every tool spawns scan.mjs, which finds its config from THIS process's cwd or INVENTORY_CONFIG (inherited).
import {execFileSync} from "node:child_process";
import {createInterface} from "node:readline";
import {fileURLToPath} from "node:url";
import {join, dirname} from "node:path";

const SCAN = join(dirname(fileURLToPath(import.meta.url)), "scan.mjs");

/**
 * Runs the scanner as a child process and returns its stdout.
 * @param {string[]} args CLI arguments for scan.mjs.
 * @returns {string} The trimmed output.
 * @throws {Error} With the scanner's own message (for example the missing-config error), not the spawn noise.
 */
function runScan(args) {
  try {
    return execFileSync(process.execPath, [SCAN, ...args], {encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"]}).trim();
  } catch (e) {
    throw new Error(String(e.stderr || e.message).trim());
  }
}
function applyJq(result, filter) {
  const input = typeof result === "string" ? result : JSON.stringify(result);
  try {
    // "--" ends option parsing, so a filter that starts with "-" cannot smuggle in a jq flag.
    return execFileSync("jq", ["--", filter], {input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024}).trim();
  } catch (e) {
    throw new Error(`jq failed: ${e.stderr || e.message}`);
  }
}

const slotProp = {
  slot: {type: "string", description: "Cascade-slot name of the component (the file's base name, e.g. ItdSelect, GenericInput)"}
};
const tools = {
  affected: {
    description:
      "What a change to a component touches: its instances per layer, ALL its descendants by extends (the subtree is the regression list), and its callers (back/projects/render).",
    inputSchema: {type: "object", properties: slotProp, required: ["slot"]},
    handler: a => runScan(["affected", a.slot])
  },
  branch: {
    description: "The COMPLETE branch of a component: ancestors (up to the root) -> the node with its instances per layer -> descendants.",
    inputSchema: {type: "object", properties: slotProp, required: ["slot"]},
    handler: a => runScan(["branch", a.slot])
  },
  callers: {
    description:
      "The CALLERS of a component: declarations in back/projects (component: \"X\", with kebab variants and without the configured prefix) + render references in the fronts (resolveTag/resolveComp/localImport).",
    inputSchema: {type: "object", properties: slotProp, required: ["slot"]},
    handler: a => runScan(["callers", a.slot])
  },
  hasCaller: {
    description: "The inverse question: does ANYONE call this component? (boolean + where).",
    inputSchema: {type: "object", properties: slotProp, required: ["slot"]},
    handler: a => runScan(["hascaller", a.slot])
  },
  orphans: {
    description:
      "Components with NO children, NO callers and NO render references. These are FLAGS to evaluate a CONTRACT (a transitive core with zero hits is a capability waiting for a consumer), NEVER a delete list.",
    inputSchema: {type: "object", properties: {}},
    handler: () => runScan(["orphans"])
  },
  summary: {
    description: "Inventory summary: total components/instances, scanned layers, tree roots. Also refreshes inventory.json (for external jq pipes).",
    inputSchema: {type: "object", properties: {}},
    handler: () => runScan([])
  }
};

// ── JSON-RPC over stdio ──
const jsonrpc = (id, result) => JSON.stringify({jsonrpc: "2.0", id, result});
const jsonrpcError = (id, code, message) => JSON.stringify({jsonrpc: "2.0", id, error: {code, message}});

async function handleMessage({method, params, id}) {
  switch (method) {
    case "initialize":
      return jsonrpc(id, {
        protocolVersion: "2025-03-26",
        capabilities: {tools: {}},
        serverInfo: {name: "itdfw-inventory", version: "0.2.0"}
      });
    case "notifications/initialized":
      return null;
    case "tools/list":
      return jsonrpc(id, {
        tools: Object.entries(tools).map(([name, t]) => ({
          name,
          description: t.description,
          inputSchema: {
            ...t.inputSchema,
            properties: {
              ...t.inputSchema.properties,
              jq: {type: "string", description: "Optional jq filter applied to the result (scope/reshape)"}
            }
          }
        }))
      });
    case "tools/call": {
      const tool = tools[params?.name];
      if (!tool) return jsonrpcError(id, -32602, `Tool not found: ${params?.name}`);
      try {
        const {jq, ...args} = params.arguments || {};
        let result = await tool.handler(args);
        if (jq) result = applyJq(result, jq);
        return jsonrpc(id, {content: [{type: "text", text: String(result)}]});
      } catch (e) {
        return jsonrpc(id, {content: [{type: "text", text: e.message}], isError: true});
      }
    }
    default:
      if (id == null) return null; // unknown notification: silent
      return jsonrpcError(id, -32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({input: process.stdin});
rl.on("line", async line => {
  if (!line.trim()) return;
  try {
    const response = await handleMessage(JSON.parse(line));
    if (response) process.stdout.write(`${response}\n`);
  } catch (e) {
    process.stdout.write(`${jsonrpcError(null, -32700, `Parse error: ${e.message}`)}\n`);
  }
});
