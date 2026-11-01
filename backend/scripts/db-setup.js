// npm run db:setup — creates/updates the zam_hrms database.
// Runs database/zam_hrms.sql (your schema, unchanged) then database/02_extensions.sql.
// Safe to re-run: steps that were already applied are skipped.
import path from 'path';
import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.js';

const sqlFile = (name) => path.resolve(import.meta.dirname, '../../database', name);
import { retryDeferred, runSqlFile } from './sql-runner.js';

const main = async () => {
  const { database, ...server } = dbConfig;
  console.log(`Connecting to MySQL ${server.user}@${server.host}:${server.port} …`);
  const conn = await mysql.createConnection(server);
  try {
    const s1 = await runSqlFile(conn, sqlFile('zam_hrms.sql'));
    console.log(`✔ zam_hrms.sql      applied ${s1.applied}, already present ${s1.skipped}`);
    await conn.query(`use \`${database}\``);
    const s2 = await runSqlFile(conn, sqlFile('02_extensions.sql'));
    console.log(`✔ 02_extensions.sql applied ${s2.applied}, already present ${s2.skipped}`);
    const still = await retryDeferred(conn, [...s1.deferred, ...s2.deferred]);
    if (still.length) {
      console.log('\n⚠ Skipped because referenced rows are missing:');
      still.forEach((d) => console.log(`  • ${d.stmt.split('\n')[0].slice(0, 80)}…  (${d.err.sqlMessage.slice(0, 120)})`));
      console.log('  The users rows in zam_hrms.sql need employees 657, 50403 and 50404.');
      console.log('  Add those employees, or run `npm run db:seed` to insert demo data, then run db:setup again.');
    }
    console.log('\nDatabase is ready. Start the app with: npm run dev');
  } finally {
    await conn.end();
  }
};

main().catch((err) => {
  console.error(`\n✖ Setup failed: ${err.code === 'ER_ACCESS_DENIED_ERROR' ? 'MySQL rejected the login — set DB_USER / DB_PASSWORD in .env' : err.message}`);
  process.exit(1);
});
