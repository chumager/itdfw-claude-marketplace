// Shared bench: a temporary world (rooms, sessions, HOME) so that no test can reach a real session or a real room.
import {execFile, fork, spawn} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOM_BIN = process.env.ROOM_BIN || path.join(here, "..", "room.mjs");

/** Polls until `check` returns something truthy, or fails with `label`. */
export async function until(check, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

/** Waits long enough for anything already sent to arrive, so a test can assert that nothing did. */
export const settle = () => new Promise(resolve => setTimeout(resolve, 150));

/** Builds an isolated world and the helpers to populate it. */
export function createWorld() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "room-"));
  const env = {
    ...process.env,
    HOME: root,
    ROOM_DIR: path.join(root, "rooms"),
    ROOM_SESSIONS_DIR: path.join(root, "sessions"),
    ROOM_USER: "ana"
  };
  fs.mkdirSync(env.ROOM_SESSIONS_DIR);
  const sessions = [];
  const children = [];

  return {
    env,
    roomFile: room => path.join(env.ROOM_DIR, `${room}.jsonl`),
    records(room) {
      return fs.readFileSync(path.join(env.ROOM_DIR, `${room}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
    },
    /** Starts a fake session called `name`; resolves once its socket is listening. */
    async session(name) {
      const child = fork(path.join(here, "fake-session.mjs"), [name, ROOM_BIN], {env});
      const pending = new Map();
      const session = {name, child, inbox: [], rejected: 0};
      let nextId = 0;
      await new Promise(resolve => {
        child.on("message", message => {
          if (message.ready) return resolve();
          if (message.rejected) return session.rejected++;
          if (message.received !== undefined) return session.inbox.push(message);
          pending.get(message.id)(message);
        });
      });
      const request = payload => new Promise(resolve => {
        const id = ++nextId;
        pending.set(id, resolve);
        child.send({id, ...payload});
      });
      session.room = (...run) => request({run});
      session.stopListening = () => request({stopListening: true});
      session.die = () => new Promise(resolve => {
        child.once("exit", resolve);
        child.kill("SIGKILL");
      });
      sessions.push(session);
      return session;
    },
    /** Runs `room` as the person, outside any session. */
    person(...run) {
      return new Promise(resolve => execFile(process.execPath, [ROOM_BIN, ...run], {env, encoding: "utf8"},
        (error, stdout, stderr) => resolve({code: error ? error.code : 0, stdout, stderr})));
    },
    /** Opens `room <name>` with piped stdin and stdout. */
    interactive(name) {
      const child = spawn(process.execPath, [ROOM_BIN, name], {env, stdio: ["pipe", "pipe", "pipe"]});
      children.push(child);
      const view = {child, output: ""};
      child.stdout.on("data", chunk => (view.output += chunk));
      child.stderr.on("data", chunk => (view.output += chunk));
      view.type = line => child.stdin.write(`${line}\n`);
      view.exited = new Promise(resolve => child.on("exit", resolve));
      return view;
    },
    /** Spawns an arbitrary command inside this world; the caller owns its streams. */
    spawn(command, args, options = {}) {
      const child = spawn(command, args, {env, ...options});
      children.push(child);
      return child;
    },
    close() {
      for (const {child} of sessions) child.kill("SIGKILL");
      for (const child of children) child.kill("SIGKILL");
      fs.rmSync(root, {recursive: true, force: true});
    }
  };
}

/** Creates a room whose participants are new fake sessions called `names`, with their inboxes empty. */
export async function roomWith(world, room, names) {
  const sessions = [];
  const founder = await world.session(names[0]);
  sessions.push(founder);
  await founder.room("invite", room, founder.name);
  for (const name of names.slice(1)) {
    const session = await world.session(name);
    await founder.room("invite", room, name);
    sessions.push(session);
  }
  await settle();
  for (const session of sessions) session.inbox.length = 0;
  return sessions;
}
