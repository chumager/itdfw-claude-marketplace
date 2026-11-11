import {createServer} from "node:http";
import {fileURLToPath} from "node:url";
import {Client} from "@modelcontextprotocol/sdk/client/index.js";
import {StdioClientTransport} from "@modelcontextprotocol/sdk/client/stdio.js";

export const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/**
 * A local HTTP listener that answers like a vector database and records every request it gets.
 * @returns {Promise<{url: string, requests: Array<{method: string, path: string, headers: Object}>, close: Function}>}
 */
export async function fakeQdrant() {
  const requests = [];
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      requests.push({method: req.method, path: req.url, headers: req.headers});
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({result: {points_count: 0}, status: "ok"}));
    });
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () => new Promise(done => server.close(done))
  };
}

/**
 * Starts `src/mcp.js` as a stdio process and connects an MCP client to it. The child only gets the variables passed
 * here (plus the SDK's safe defaults), so the run does not depend on the shell that launches the tests.
 * @param {Object} env - Environment of the server process.
 * @param {string} cwd - Working directory of the server process.
 * @returns {Promise<{client: Client, tools: () => Promise<string[]>, close: Function}>}
 */
export async function startServer(env, cwd) {
  const client = new Client({name: "graph-rag-test", version: "0.0.0"});
  await client.connect(new StdioClientTransport({command: process.execPath, args: [`${SRC}mcp.js`], env, cwd, stderr: "ignore"}));
  return {
    client,
    tools: async () => (await client.listTools()).tools.map(t => t.name),
    close: () => client.close()
  };
}
