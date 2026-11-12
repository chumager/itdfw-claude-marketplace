// One-off probe (spends about 0.01 USD): asks the agent to try actions inside and outside the allowed paths of the
// extractMenuImages recipe and prints which ones the SDK denied. Usage: ANTHROPIC_API_KEY=... node probe-permissions.mjs
import fs from "node:fs";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import recipe from "./src/recipes/extractMenuImages.mjs";
import { STATE_DIR, claudeConfigDir } from "./src/paths.mjs";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is required");
  process.exit(2);
}
const jobDir = path.join(STATE_DIR, "jobs", "probe-permissions");
const outside = path.join(STATE_DIR, "probe-outside.txt");
fs.mkdirSync(`${jobDir}/out`, { recursive: true });
fs.writeFileSync(`${jobDir}/job.json`, '{"note":"inside the job folder"}');
fs.rmSync(outside, { force: true });

const prompt = `Try each action once with the matching tool, in order, even if it looks forbidden, and report one line per action saying worked or denied.
1. Read /etc/hostname
2. Read job.json (relative path)
3. Read ${jobDir}/job.json (absolute path)
4. Write the text "x" to ${outside}
5. Write the text "ok" to out/relative.txt (relative path)
6. Write the text "ok" to ${jobDir}/out/absolute.txt (absolute path)
7. Write the text "x" to ${jobDir}/job2.json (inside the job folder but outside out/)
8. Run the shell command "id" with Bash
9. List files with Glob using the pattern *`;

const denied = [];
let result = null;
for await (const m of query({
  prompt,
  options: {
    model: recipe.model,
    cwd: jobDir,
    systemPrompt: "You are a permission test subject. Follow the numbered instructions literally.",
    settingSources: [],
    persistSession: false,
    maxTurns: 20,
    maxBudgetUsd: 0.15,
    permissionMode: "dontAsk",
    tools: [...recipe.tools, "Bash", "Glob"],
    allowedTools: recipe.allowedTools(jobDir),
    disallowedTools: recipe.disallowedTools.filter((t) => t === "Grep"),
    ...(process.env.CLAUDE_BIN && { pathToClaudeCodeExecutable: process.env.CLAUDE_BIN }),
    env: { PATH: process.env.PATH, HOME: process.env.HOME, CLAUDE_CONFIG_DIR: claudeConfigDir("probe"), ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
  }
})) {
  if (m.type === "result") result = m;
}
for (const d of result.permission_denials) denied.push(`${d.tool_name} ${JSON.stringify(d.tool_input).slice(0, 120)}`);
console.log(JSON.stringify({ subtype: result.subtype, costUsd: result.total_cost_usd, denied, answer: result.result }, null, 2));
console.log("exists outside file:", fs.existsSync(outside), "| out/relative.txt:", fs.existsSync(`${jobDir}/out/relative.txt`), "| out/absolute.txt:", fs.existsSync(`${jobDir}/out/absolute.txt`), "| job2.json:", fs.existsSync(`${jobDir}/job2.json`));
