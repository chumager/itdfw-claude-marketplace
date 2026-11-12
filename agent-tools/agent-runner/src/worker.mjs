// Per-task mode entry point: `node worker.mjs <jobDir>` runs one job and the process dies when it finishes.
import path from "node:path";
import { runJob } from "./run-job.mjs";

const jobDir = process.argv[2];
if (!jobDir) {
  console.error("usage: node worker.mjs <jobDir>");
  process.exit(2);
}
runJob(path.resolve(jobDir)).then(() => process.exit(0), (e) => {
  console.error(e);
  process.exit(1);
});
