import fs from 'fs';

// Error codes meaning "this was already applied" — safe to skip on re-runs.
const ALREADY_APPLIED = new Set([
  1007, // database exists
  1050, // table exists
  1060, // duplicate column
  1061, // duplicate key name
  1062, // duplicate entry (seed rows already inserted)
  1091, // can't drop: column already dropped
  1826, // duplicate foreign key name
  3822, // duplicate check constraint name
]);
const FK_MISSING = 1452; // referenced row missing — retried at the end

export const splitSql = (text) =>
  text
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

export const runSqlFile = async (conn, file, { log = console.log } = {}) => {
  const stats = { applied: 0, skipped: 0, deferred: [] };
  for (const stmt of splitSql(fs.readFileSync(file, 'utf8'))) {
    try {
      await conn.query(stmt);
      stats.applied += 1;
    } catch (err) {
      if (ALREADY_APPLIED.has(err.errno)) stats.skipped += 1;
      else if (err.errno === FK_MISSING) stats.deferred.push({ stmt, err });
      else {
        log(`\n✖ Failed in ${file}:\n${stmt.slice(0, 300)}\n→ ${err.code}: ${err.sqlMessage || err.message}`);
        throw err;
      }
    }
  }
  return stats;
};

export const retryDeferred = async (conn, deferred) => {
  const still = [];
  for (const d of deferred) {
    try {
      await conn.query(d.stmt);
    } catch (err) {
      if (ALREADY_APPLIED.has(err.errno)) continue;
      still.push({ ...d, err });
    }
  }
  return still;
};
