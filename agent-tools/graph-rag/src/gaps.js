const now = () => new Date().toISOString();

let db;

/**
 * Whether the gaps feature is on: it is opt-in, and `GAPS_DB` (the path of its SQLite file) turns it on.
 * @returns {boolean} True when `GAPS_DB` is set.
 */
export const enabled = () => Boolean(process.env.GAPS_DB);

/**
 * The store, opened on first use. Nothing is opened at import or at start, and `node:sqlite` is not even loaded
 * unless the feature is used.
 * @returns {import("node:sqlite").DatabaseSync} The open store, with its table created.
 * @throws {Error} When `GAPS_DB` is not set.
 */
function open() {
  if (db) return db;
  if (!enabled()) throw new Error("the gaps store is disabled: set GAPS_DB to the path of its SQLite file");
  const {DatabaseSync} = process.getBuiltinModule("node:sqlite");
  db = new DatabaseSync(process.env.GAPS_DB);
  db.exec(`
    CREATE TABLE IF NOT EXISTS gaps (
      id INTEGER PRIMARY KEY,
      need TEXT NOT NULL,
      queries TEXT NOT NULL,
      got TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      hits INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      seen_at TEXT NOT NULL,
      closed_at TEXT,
      resolution TEXT
    );
    CREATE INDEX IF NOT EXISTS gaps_status ON gaps(status);
  `);
  return db;
}

/**
 * Records a need the index did not satisfy. The NEED is written in plain intent, not as the technical term: the
 * vocabulary that finds nothing today is exactly what has to be captured.
 *
 * It never de-duplicates by deleting: a gap that REAPPEARS is the most valuable signal, it means the previous fix did
 * not work. So hits are counted and a closed gap that comes back is reopened.
 * @param {{need: string, queries?: string|string[], got?: string}} gap - The need, the queries tried and what came back.
 * @returns {{id: number, hits: number, reincidente: boolean, reabierto?: boolean}} The gap's id, its repeat count and
 * whether it was a repeat (`reincidente`) and had been closed (`reabierto`).
 */
export function report({need, queries, got}) {
  const qs = [].concat(queries ?? []).join(" | ");
  const previo = open().prepare(`SELECT id, status, hits FROM gaps WHERE need = ?`).get(need);
  if (previo) {
    open().prepare(`UPDATE gaps SET hits = hits + 1, seen_at = ?, queries = ?, got = ?, status = 'open' WHERE id = ?`).run(
      now(),
      qs,
      got ?? null,
      previo.id
    );
    return {
      id: previo.id,
      hits: previo.hits + 1,
      reincidente: true,
      reabierto: previo.status !== "open"
    };
  }
  const {lastInsertRowid} = open()
    .prepare(`INSERT INTO gaps (need, queries, got, created_at, seen_at) VALUES (?, ?, ?, ?, ?)`)
    .run(need, qs, got ?? null, now(), now());
  return {id: Number(lastInsertRowid), hits: 1, reincidente: false};
}

/**
 * Lists gaps; with no argument, the open ones, which is the normal use.
 * @param {{status?: string, all?: boolean}} [options] - `all` returns every gap whatever its status.
 * @returns {Object[]} Rows of the `gaps` table, most repeated first.
 */
export function list({status = "open", all = false} = {}) {
  return all
    ? open().prepare(`SELECT * FROM gaps ORDER BY hits DESC, seen_at DESC`).all()
    : open().prepare(`SELECT * FROM gaps WHERE status = ? ORDER BY hits DESC, seen_at DESC`).all(status);
}

/**
 * Marks a gap resolved. The row is kept: the history is what lets a repeat be detected.
 * @param {number} id - The gap's id.
 * @param {string} [resolution] - What was done to resolve it.
 * @returns {boolean} False when there is no such gap.
 */
export function close(id, resolution) {
  const r = open().prepare(`UPDATE gaps SET status = 'resolved', closed_at = ?, resolution = ? WHERE id = ?`).run(
    now(),
    resolution ?? null,
    id
  );
  return r.changes > 0;
}

/**
 * Discards a gap. It is NOT for deleting what was resolved (that is kept to detect repeats).
 * @param {number} id - The gap's id.
 * @param {string} [motivo] - Why it is discarded.
 * @returns {boolean} False when there is no such gap.
 */
export function discard(id, motivo) {
  const r = open().prepare(`UPDATE gaps SET status = 'wontfix', closed_at = ?, resolution = ? WHERE id = ?`).run(
    now(),
    motivo ?? null,
    id
  );
  return r.changes > 0;
}

/**
 * Counts gaps by status.
 * @returns {{abiertos: number, resueltos: number, descartados: number, reincidentes: number}} Open, resolved and
 * discarded gaps, and the open ones that were reported more than once.
 */
export function stats() {
  const row = open()
    .prepare(
      `SELECT
         SUM(status = 'open') AS abiertos,
         SUM(status = 'resolved') AS resueltos,
         SUM(status = 'wontfix') AS descartados,
         SUM(status = 'open' AND hits > 1) AS reincidentes
       FROM gaps`
    )
    .get();
  return {abiertos: row.abiertos ?? 0, resueltos: row.resueltos ?? 0, descartados: row.descartados ?? 0, reincidentes: row.reincidentes ?? 0};
}
