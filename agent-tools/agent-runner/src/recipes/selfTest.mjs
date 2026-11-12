// Plumbing recipe: no model call. Sleeps and writes a file, to test the queue, the watcher and the callback for free.
import fs from "node:fs";
import path from "node:path";

export default {
  name: "selfTest",
  kind: "local",
  params: { sleepMs: { type: "integer", min: 0, max: 60000 } },
  requiredOutputs: ["hello.txt"],
  async run({ jobDir, params }) {
    await new Promise((resolve) => setTimeout(resolve, params.sleepMs ?? 0));
    fs.writeFileSync(path.join(jobDir, "out", "hello.txt"), "hello\n");
    return { costUsd: 0 };
  }
};
