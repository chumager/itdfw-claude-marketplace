import assert from "node:assert/strict";
import {fork} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {after, before, it} from "node:test";
import {fileURLToPath} from "node:url";
import {createWorld, ROOM_BIN} from "./harness.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WRITERS = 8;
const LINES = 100;
const SIZE = 16 * 1024;

let world;
before(() => (world = createWorld()));
after(() => world.close());

it("processes released from a barrier neither lose nor mix lines, and they did collide", async t => {
  const writers = Array.from({length: WRITERS}, (_, index) =>
    fork(path.join(here, "append-writer.mjs"), [ROOM_BIN, "race", `w${index}`, String(LINES), String(SIZE)], {env: world.env}));

  const nextMessage = writer => new Promise((resolve, reject) => {
    writer.once("message", resolve);
    writer.once("exit", code => reject(new Error(`writer exited with ${code}`)));
  });
  await Promise.all(writers.map(nextMessage));
  const finished = Promise.all(writers.map(nextMessage));
  for (const writer of writers) writer.send("go");
  await finished;

  const lines = fs.readFileSync(world.roomFile("race"), "utf8").trim().split("\n");
  assert.equal(lines.length, WRITERS * LINES, "no line lost");

  const lastSeq = new Map();
  let switches = 0;
  let previous;
  for (const line of lines) {
    const record = JSON.parse(line);
    assert.equal(record.text.length, SIZE, "no line mixed");
    assert.equal(record.seq, (lastSeq.get(record.from) ?? -1) + 1, "each writer stays in order");
    lastSeq.set(record.from, record.seq);
    if (previous && previous !== record.from) switches++;
    previous = record.from;
  }
  t.diagnostic(`writer switches: ${switches}`);
  assert.ok(switches >= WRITERS, `the writers must interleave to prove a collision, got ${switches} switches`);
});
