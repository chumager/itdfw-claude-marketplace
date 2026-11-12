// Where the runner keeps its data. Nothing lives outside these folders.
import os from "node:os";
import path from "node:path";

/** Root of all runner data. Override with AGENT_RUNNER_STATE. */
export const STATE_DIR = path.resolve(process.env.AGENT_RUNNER_STATE || path.join(os.tmpdir(), "agent-runner"));

/** One folder per job (job.json, meta.json, in/, out/). Override with JOBS_DIR. */
export const JOBS_DIR = path.resolve(process.env.JOBS_DIR || path.join(STATE_DIR, "jobs"));

/** Raw benchmark results and the spend ledger written by bench.mjs. */
export const RESULTS_DIR = path.join(STATE_DIR, "results");

/**
 * Per-job configuration folder for the `claude` child (its own, so the host's settings never leak in).
 * @param {string} id Job id.
 * @returns {string} absolute folder path.
 */
export const claudeConfigDir = (id) => path.join(STATE_DIR, "claude-config", id);
