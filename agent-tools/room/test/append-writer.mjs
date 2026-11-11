// One competitor of the concurrency test: announces it is ready, waits for the signal, then appends without pausing.
const [roomBin, room, writer, count, size] = process.argv.slice(2);
const {appendRecord} = await import(roomBin);
const padding = "x".repeat(Number(size));
process.send("ready");
process.once("message", () => {
  for (let seq = 0; seq < Number(count); seq++) appendRecord(room, {type: "msg", from: writer, text: padding, seq});
  process.send("done", () => process.exit(0));
});
