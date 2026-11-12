// Runs ONE job to completion. Shared by both modes: inline (called by the live service) and spawn (via worker.mjs).
// Contract: reads <jobDir>/job.json, appends out/calls.jsonl while running, writes out/done.json (atomically) last.
import fs from "node:fs";
import path from "node:path";
import { claudeConfigDir } from "./paths.mjs";

const summarize = (input) => {
  const text = JSON.stringify(input ?? {});
  return text.length > 300 ? `${text.slice(0, 300)}...(${text.length} chars)` : text;
};

const textOf = (content) => (typeof content === "string" ? content : Array.isArray(content) ? content.map((b) => (b && b.type === "text" ? b.text : "")).join("") : "");

async function runSdk(job, recipe, jobDir, outDir) {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const log = (entry) => fs.appendFileSync(path.join(outDir, "calls.jsonl"), `${JSON.stringify({ t: Date.now(), ...entry })}\n`);
  const names = new Map();
  const toolCounts = {};
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), recipe.timeoutMs);
  const ctx = { jobDir, params: job.params, outDir };

  const options = {
    model: recipe.model,
    cwd: jobDir,
    systemPrompt: recipe.systemPrompt(ctx),
    settingSources: [],
    persistSession: false,
    maxTurns: recipe.maxTurns,
    maxBudgetUsd: job.params?.maxBudgetUsd ?? recipe.maxBudgetUsd,
    abortController,
    permissionMode: "dontAsk",
    tools: recipe.tools,
    allowedTools: recipe.allowedTools(jobDir),
    disallowedTools: recipe.disallowedTools,
    stderr: (data) => fs.appendFileSync(path.join(outDir, "cli-stderr.log"), data),
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      CLAUDE_CONFIG_DIR: claudeConfigDir(job.id),
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
    }
  };
  if (process.env.CLAUDE_BIN) options.pathToClaudeCodeExecutable = process.env.CLAUDE_BIN;

  let firstMessageAt = null;
  let result = null;
  let resultAt = null;
  let error = null;
  try {
    for await (const message of query({ prompt: recipe.prompt(ctx), options })) {
      if (!firstMessageAt) firstMessageAt = Date.now();
      if (message.type === "system" && message.subtype === "init") {
        log({ event: "init", mcpServers: message.mcp_servers, toolCount: message.tools?.length, mcpTools: (message.tools || []).filter((n) => n.startsWith("mcp__")) });
      } else if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type !== "tool_use") continue;
          names.set(block.id, block.name);
          toolCounts[block.name] = (toolCounts[block.name] || 0) + 1;
          log({ event: "tool_use", id: block.id, name: block.name, args: summarize(block.input) });
        }
      } else if (message.type === "user" && Array.isArray(message.message.content)) {
        for (const block of message.message.content) {
          if (block.type !== "tool_result") continue;
          const body = textOf(block.content);
          log({ event: "tool_result", id: block.tool_use_id, name: names.get(block.tool_use_id), is_error: Boolean(block.is_error), chars: body.length, head: block.is_error ? body.slice(0, 200) : undefined });
        }
      } else if (message.type === "result") {
        result = message;
        resultAt = Date.now();
      }
    }
  } catch (e) {
    error = abortController.signal.aborted ? `timeout after ${recipe.timeoutMs} ms` : String(e && e.message ? e.message : e);
  } finally {
    clearTimeout(timer);
  }

  for (const denial of (result && result.permission_denials) || []) log({ event: "denied", id: denial.tool_use_id, name: denial.tool_name, args: summarize(denial.tool_input) });
  const failed = result && (result.is_error || result.subtype !== "success");
  return {
    firstMessageAt,
    resultAt,
    toolCounts,
    error: error || (failed ? `${result.subtype}${result.errors?.length ? `: ${result.errors.join("; ")}` : ""}` : null),
    sdk: result && {
      subtype: result.subtype,
      costUsd: result.total_cost_usd,
      usage: result.usage,
      modelUsage: result.modelUsage,
      numTurns: result.num_turns,
      durationMs: result.duration_ms,
      durationApiMs: result.duration_api_ms,
      permissionDenials: (result.permission_denials || []).length,
      answer: typeof result.result === "string" ? result.result.slice(0, 500) : undefined
    }
  };
}

/**
 * Executes the job whose folder is `jobDir` and leaves its files in `<jobDir>/out`.
 * @param {string} jobDir Absolute job folder containing job.json; it is also the agent's cwd.
 * @returns {Promise<void>} Resolves when out/done.json has been written (it never rejects: failures go in done.json).
 */
export async function runJob(jobDir) {
  const bootAt = Date.now();
  const outDir = path.join(jobDir, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const job = JSON.parse(fs.readFileSync(path.join(jobDir, "job.json"), "utf8"));
  const { recipes } = await import("./recipes/index.mjs");
  const recipe = recipes[job.command];
  const done = { id: job.id, command: job.command, status: "failed", error: null, bootAt, firstMessageAt: null, endedAt: null };
  try {
    if (!recipe) throw new Error(`unknown command: ${job.command}`);
    Object.assign(done, recipe.kind === "local" ? await recipe.run({ jobDir, params: job.params }) : await runSdk(job, recipe, jobDir, outDir));
    const missing = (recipe.requiredOutputs || []).filter((name) => !fs.existsSync(path.join(outDir, name)));
    if (!done.error && missing.length) done.error = `missing outputs: ${missing.join(", ")}`;
    done.status = done.error ? "failed" : "done";
  } catch (e) {
    done.error = String(e && e.message ? e.message : e);
  }
  done.endedAt = Date.now();
  const tmp = path.join(outDir, ".done.json.tmp");
  fs.writeFileSync(tmp, JSON.stringify(done, null, 2));
  fs.renameSync(tmp, path.join(outDir, "done.json"));
}
