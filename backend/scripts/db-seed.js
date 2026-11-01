// npm run db:seed — OPTIONAL demo data for trying the app.
// Inserts demo employees/users/leave types (INSERT IGNORE — never overwrites), Pakistan
// public holidays, and ~2 months of generated attendance. Attendance, leave and
// correction demo rows are only generated when those tables are empty.
import path from 'path';
import mysql from 'mysql2/promise';
import { dbConfig } from '../src/config/database.js';

const sqlFile = (name) => path.resolve(import.meta.dirname, '../../database', name);
import { retryDeferred, runSqlFile } from './sql-runner.js';
import { addDays, minToTime, monthKeyOf, shiftMonth, timeToMin, todayStr } from '../src/shared/dates';

const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));

const main = async () => {
  const conn = await mysql.createConnection({ ...dbConfig, dateStrings: true });
  try {
    const s = await runSqlFile(conn, sqlFile('03_seed.sql'));
    const still = await retryDeferred(conn, s.deferred);
    if (still.length) console.log(`⚠ ${still.length} seed row(s) skipped (missing references).`);
    console.log('✔ Demo employees, users and leave types (existing rows with the same IDs were kept)');

    // Pakistan fixed-date public holidays for this year (Eid dates vary — add them in the app).
    const year = todayStr().slice(0, 4);
    const [[{ n: holCount }]] = await conn.query('select count(*) as n from holiday where year(holiday_from_date) = ?', [year]);
    if (!holCount) {
      const hol = [['Kashmir Solidarity Day', '02-05'], ['Pakistan Day', '03-23'], ['Labour Day', '05-01'], ['Independence Day', '08-14'], ['Iqbal Day', '11-09'], ['Quaid-e-Azam Day', '12-25']];
      for (const [name, md] of hol) {
        const d = `${year}-${md}`;
        const [res] = await conn.query('insert into holiday (holiday_name, holiday_from_date, holiday_to_date) values (?,?,?)', [name, d, d]);
        await conn.query("update calendar set day_status = 'Holiday', holiday_id = ? where calendar_date = ?", [res.insertId, d]);
      }
      console.log(`✔ ${hol.length} public holidays added for ${year}`);
    }

    const [[{ n: attCount }]] = await conn.query('select count(*) as n from attendance');
    if (attCount) {
      console.log('• Attendance table already has data — demo attendance not generated.');
      return;
    }

    const [emps] = await conn.query(
      `select e.employee_id, e.joining_date, s.reporting_time, s.half_day_after, s.normal_out_time
       from employees e join designations g on g.designation_id = e.designation_id
       left join schedule s on s.schedule_id = g.schedule_id
       where e.status not in ('Inactive', 'Terminated')`
    );
    const today = todayStr();
    const start = `${shiftMonth(monthKeyOf(today), -2)}-01`;
    const [cal] = await conn.query("select calendar_id, calendar_date, day_status from calendar where calendar_date between ? and ?", [start, today]);
    const calByDate = Object.fromEntries(cal.map((c) => [c.calendar_date, c]));

    const rows = [];
    for (const e of emps) {
      const rand = rng(hashStr(String(e.employee_id)));
      const startMin = timeToMin((e.reporting_time || '09:00:00').slice(0, 5));
      const endMin = timeToMin((e.normal_out_time || '18:00:00').slice(0, 5));
      const halfMin = timeToMin((e.half_day_after || '13:00:00').slice(0, 5));
      for (let d = start; d < today; d = addDays(d, 1)) {
        const c = calByDate[d];
        if (!c || d < e.joining_date || c.day_status !== 'Working') continue;
        const roll = rand();
        if (roll < 0.03) continue; // absent
        let inMin = startMin + between(rand, -12, 10);
        let status = 'Present';
        let remarks = null;
        if (roll < 0.05) { inMin = halfMin + between(rand, 10, 40); status = 'Half Day'; remarks = 'Arrived after half-day time'; }
        else if (roll < 0.13) { inMin = startMin + between(rand, 20, 50); status = 'Late'; remarks = 'Late arrival'; }
        let outMin = endMin + between(rand, -5, 30);
        if (rand() < 0.12) outMin += between(rand, 60, 120);
        const lunch = 13 * 60 + between(rand, -15, 15);
        const breaks = inMin < lunch ? [{ start: minToTime(lunch), end: minToTime(lunch + between(rand, 40, 60)) }] : [];
        rows.push([e.employee_id, c.calendar_id, minToTime(inMin), minToTime(outMin), status, remarks, 0, 'Biometric', JSON.stringify({ label: 'Head Office Biometric Terminal', inFence: true }), JSON.stringify(breaks)]);
      }
    }
    if (rows.length) {
      await conn.query('insert into attendance (employee_id, calendar_id, in_time, out_time, status, remarks, is_manual, check_in_method, location, breaks) values ?', [rows]);
    }
    console.log(`✔ ${rows.length} demo attendance rows generated (${start} → yesterday)`);

    const [[{ n: lvCount }]] = await conn.query('select count(*) as n from leave_request');
    const ids = new Set(emps.map((e) => e.employee_id));
    if (!lvCount && ids.has(50403) && ids.has(50404)) {
      const nextMonth = shiftMonth(monthKeyOf(today), 1);
      await conn.query(
        `insert into leave_request (employee_id, leave_type_id, from_date, to_date, total_days, reason, manager_status, hr_status, manager_action_date)
         values (50403, 1, ?, ?, 3, 'Family wedding', 'Pending', 'Pending', null),
                (50404, 3, ?, ?, 1, 'Fever', 'Approved', 'Approved', curdate())`,
        [`${nextMonth}-10`, `${nextMonth}-12`, addDays(today, -6), addDays(today, -6)]
      );
      console.log('✔ Demo leave requests added');
    }
    const [[{ n: regCount }]] = await conn.query('select count(*) as n from attendance_request');
    if (!regCount) {
      const [[late]] = await conn.query(
        `select a.employee_id, a.calendar_id, a.in_time, a.out_time from attendance a
         where a.status = 'Late' and a.employee_id = 50403 order by a.calendar_id desc limit 1`
      );
      if (late) {
        await conn.query(
          'insert into attendance_request (employee_id, calendar_id, updated_in_time, updated_out_time, reason, original_in_time, original_out_time) values (?,?,?,?,?,?,?)',
          [late.employee_id, late.calendar_id, '08:45', String(late.out_time).slice(0, 5), 'Traffic jam on Shahrah-e-Faisal — reached office gate on time.', late.in_time, late.out_time]
        );
        console.log('✔ Demo attendance correction added');
      }
    }
    console.log('\nDemo logins (username / password): 657/657 (HR = Owner), 50401/50401 (Department Head = Manager), 50403/50403 (Employee)');
  } finally {
    await conn.end();
  }
};

main().catch((err) => {
  console.error(`\n✖ Seed failed: ${err.message}`);
  process.exit(1);
});
