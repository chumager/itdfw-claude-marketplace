import assert from "node:assert/strict";
import {after, before, it} from "node:test";
import {createWorld, ROOM_BIN, until} from "./harness.mjs";

let world;
before(() => (world = createWorld()));
after(() => world.close());

const plain = text => text.replace(/\u001b\[[0-9;]*m/g, "");

/** Opens `room <name>` in a real pseudo terminal with a session invited, and returns the view. */
async function openTerminal(name, sessionName) {
  const session = await world.session(sessionName);
  // util-linux `script` gives the process a real pseudo terminal; its flags differ on other systems.
  const terminal = world.spawn("script", ["-qfc", `${process.execPath} ${ROOM_BIN} ${name}`, "/dev/null"], {stdio: ["pipe", "pipe", "pipe"]});
  const view = {terminal, session, output: "", exited: new Promise(resolve => terminal.on("exit", resolve))};
  terminal.stdout.on("data", chunk => (view.output += chunk));
  await until(() => view.output.includes(`[${name}]`), "the prompt");
  terminal.stdin.write(`/invite ${sessionName}\r`);
  await until(() => session.inbox.length === 1, "the invitation");
  return view;
}

it("in a real terminal a live message keeps what is being typed, and cannot drive the terminal", {skip: process.platform !== "linux"}, async () => {
  const view = await openTerminal("tty", "tty-b");
  view.terminal.stdin.write("half typed");
  await until(() => view.output.includes("half typed"), "the echo");
  const mark = view.output.length;
  await view.session.room("say", "tty", "live \u001b[31mred\u001b[0m text");
  await until(() => plain(view.output.slice(mark)).includes("[tty-b]: live"), "the live message");
  await until(() => {
    const shown = plain(view.output.slice(mark));
    return shown.slice(shown.indexOf("[tty-b]: live")).includes("half typed");
  }, "the typed text redrawn after the message");
  assert.ok(!view.output.slice(mark).includes("\u001b[31m"), "an escape sequence in a message must not reach the terminal");

  view.terminal.stdin.write("\u0015/leave\r");
  await view.exited;
  assert.ok(world.records("tty").some(record => record.who === "ana" && record.reason === "leave"));
});

it("markdown is rendered in the terminal, but an escape sequence inside it is not", {skip: process.platform !== "linux"}, async () => {
  const view = await openTerminal("ttymd", "ttymd-b");
  const mark = view.output.length;
  await view.session.room("say", "ttymd", "**bold** \u001b[31mred\u001b[0m `code`");
  await until(() => plain(view.output.slice(mark)).includes("[ttymd-b]: bold"), "the rendered message");
  const shown = view.output.slice(mark);
  assert.ok(shown.includes("\u001b[1mbold"), "the markdown bold is rendered by the room");
  assert.ok(!shown.includes("\u001b[31m"), "the escape sequence inside the message is stripped before rendering");
  assert.ok(!plain(shown).includes("**"), "the markdown markers are not shown");

  view.terminal.stdin.write("/leave\r");
  await view.exited;
});
