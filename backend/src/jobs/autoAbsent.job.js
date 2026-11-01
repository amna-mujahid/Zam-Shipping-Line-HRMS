// Auto-absent: for every active employee, each working day (not an off day, holiday or
// approved leave) that has no attendance row is written as status 'Absent' once the day
// is over — past days, and today after the schedule's normal out time.
// AUTO_ABSENT_DAYS in .env sets how many days back to look (default 31, 0 = off).
import { pool } from '../config/database.js';
import { env } from '../config/env.js';
import { calendarIdsBetween, loadReference } from '../repositories/reference.repository.js';
import { loadActiveEmployees } from '../repositories/employee.repository.js';
import { AUTO_METHOD, insertIgnoreAttendanceRows, loadAttendance } from '../repositories/attendance.repository.js';
import { loadLeaves } from '../repositories/leave.repository.js';
import { audit } from '../repositories/audit.repository.js';
import { engineCtx } from '../utils/attendanceEngine.js';
import { computeDay } from '../shared/attendance';
import { addDays, todayStr } from '../shared/dates';

export const autoMarkAbsent = async () => {
  const days = env.autoAbsentDays;
  if (!days) return 0;
  const today = todayStr();
  const from = addDays(today, -days);
  const ref = await loadReference(pool);
  const employees = await loadActiveEmployees(pool, ref);
  const ctx = engineCtx(ref, await loadAttendance(pool, { from, to: today }), await loadLeaves(pool, { approvedOnly: true }));
  const calId = await calendarIdsBetween(pool, from, today);

  const rows = [];
  for (const emp of employees) {
    for (let d = from; d <= today; d = addDays(d, 1)) {
      if (!calId[d]) continue;
      const day = computeDay(emp, d, ctx);
      if (day.status === 'ABSENT' && !day.record) {
        rows.push([emp.employeeId, calId[d], 'Absent', 'Auto absent: no check-in', 1, AUTO_METHOD, '[]']);
      }
    }
  }
  if (!rows.length) return 0;
  const inserted = await insertIgnoreAttendanceRows(pool, rows);
  if (inserted) {
    await audit(pool, null, 'AUTO_ABSENT', 'attendance', null, `Auto-marked ${inserted} missing working day(s) as Absent.`, null, { rows: inserted, from, to: today });
  }
  return inserted;
};
