// A real process with a session file, a key and a socket in a temporary directory. It runs `room` as its own child,
// so the tool finds it by walking up the parent processes, exactly as it finds a real session.
import {execFile} from "node:child_process";
import {randomBytes} from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const [name, roomBin] = process.argv.slice(2);
const dir = process.env.ROOM_SESSIONS_DIR;
const socketPath = path.join(dir, `${process.pid}.sock`);
const token = randomBytes(8).toString("hex");

const server = net.createServer(socket => {
  let buffer = "";
  socket.on("data", chunk => (buffer += chunk));
  socket.on("end", () => {
    const [auth, message] = buffer.trim().split("\n").map(line => JSON.parse(line));
    if (auth.type !== "auth" || auth.token !== token) return process.send({rejected: true});
    process.send({received: message.message.content, role: message.message.role, type: message.type});
  });
});

server.listen(socketPath, () => {
  fs.writeFileSync(path.join(dir, `${process.pid}.fake.key`), JSON.stringify({peerToken: token}));
  fs.writeFileSync(path.join(dir, `${process.pid}.json`), JSON.stringify({pid: process.pid, name, messagingSocketPath: socketPath}));
  process.send({ready: process.pid});
});

process.on("message", ({id, run, stopListening}) => {
  if (stopListening) return server.close(() => process.send({id}));
  execFile(process.execPath, [roomBin, ...run], {encoding: "utf8"}, (error, stdout, stderr) =>
    process.send({id, code: error ? error.code : 0, stdout, stderr}));
});
