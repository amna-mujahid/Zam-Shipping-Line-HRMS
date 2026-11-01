// Time clock (check-in/out, breaks) and attendance management (manual times, P/A/L/HD marking).
import { deleteAttendance, getRecord, upsertAttendance } from '../repositories/attendance.repository.js';
import { getEmployee } from '../repositories/employee.repository.js';
import { loadReference } from '../repositories/reference.repository.js';
import { audit } from '../repositories/audit.repository.js';
import { dbStatusForPunches } from '../utils/attendanceEngine.js';
import { fail } from '../utils/errors.js';
import { checkDate, checkTime, need, toEmployeeId } from '../utils/validators.js';
import { PERMISSIONS as P } from '../shared/permissions.js';
import { DB_STATUS } from '../shared/attendance.js';
import { minToTime, nowTimeStr, timeToMin, todayStr } from '../shared/dates.js';

const CHECK_IN_METHODS = ['Biometric', 'GPS', 'Web'];
const MARKABLE = { PRESENT: DB_STATUS.PRESENT, ABSENT: DB_STATUS.ABSENT, LATE: DB_STATUS.LATE, HALF_DAY: DB_STATUS.HALF_DAY };

// ---- time clock -------------------------------------------------------------

export async function clockIn(conn, user, { method, location, notes = '' } = {}) {
  need(user, P.TIME_CLOCK);
  if (!CHECK_IN_METHODS.includes(method)) fail('Unknown check-in method.');
  const date = todayStr();
  const existing = await getRecord(conn, user.employeeId, date);
  if (existing?.inTime) fail('You have already checked in today.');
  if (existing?.isManual && existing.manualStatus === 'ABSENT') {
    fail(existing.method === 'Auto'
      ? 'Your schedule for today has ended and you were marked absent automatically. Request a correction if this is wrong.'
      : 'You were marked absent today. Ask HR or your department head to correct it.');
  }
  if (existing?.isManual && existing.manualStatus === 'ON_LEAVE') fail('You are on approved leave today.');
  const ref = await loadReference(conn);
  const emp = await getEmployee(conn, user.employeeId, ref);
  const rec = { inTime: nowTimeStr(), outTime: null, breaks: [], method, location: location || null, notes };
  rec.status = dbStatusForPunches(emp, date, rec, ref);
  await upsertAttendance(conn, user, user.employeeId, date, rec);
  await audit(conn, user, 'CLOCK_IN', 'attendance', user.employeeId,
    `${method} check-in at ${rec.inTime}${location && location.inFence === false && method === 'GPS' ? ' (outside geofence)' : ''}.`, null, { date, in_time: rec.inTime, method });
  return { time: rec.inTime };
}

export async function clockOut(conn, user) {
  need(user, P.TIME_CLOCK);
  const date = todayStr();
  const rec = await getRecord(conn, user.employeeId, date);
  if (!rec?.inTime) fail('You have not checked in today.');
  if (rec.outTime) fail('You have already checked out.');
  const now = nowTimeStr();
  const ref = await loadReference(conn);
  const emp = await getEmployee(conn, user.employeeId, ref);
  const updated = { ...rec, outTime: now, breaks: rec.breaks.map((b) => (b.end ? b : { ...b, end: now })) };
  updated.status = dbStatusForPunches(emp, date, updated, ref);
  await upsertAttendance(conn, user, user.employeeId, date, updated);
  await audit(conn, user, 'CLOCK_OUT', 'attendance', user.employeeId, `Check-out at ${now}.`, null, { date, out_time: now });
  return { time: now };
}

export async function toggleBreak(conn, user) {
  need(user, P.TIME_CLOCK);
  const date = todayStr();
  const rec = await getRecord(conn, user.employeeId, date);
  if (!rec?.inTime || rec.outTime) fail('Breaks can only be logged while checked in.');
  const now = nowTimeStr();
  const open = rec.breaks.find((b) => !b.end);
  const breaks = open ? rec.breaks.map((b) => (b === open ? { ...b, end: now } : b)) : [...rec.breaks, { start: now, end: null }];
  await upsertAttendance(conn, user, user.employeeId, date, { ...rec, breaks, status: rec.dbStatus || DB_STATUS.PRESENT });
  return { onBreak: !open, time: now };
}

// ---- attendance management --------------------------------------------------

// A manual break of `mins` placed 3 h after check-in, but not before 12:30.
const defaultBreak = (inTime, mins) => {
  const start = Math.max(timeToMin(inTime) + 180, 12 * 60 + 30);
  return [{ start: minToTime(start), end: minToTime(start + mins) }];
};

// Manual times for one employee-day. inTime = null clears the day.
export async function saveAttendance(conn, user, empId, date, { inTime, outTime, breakMinutes = 60, notes } = {}) {
  need(user, P.ATTENDANCE_EDIT);
  const employeeId = toEmployeeId(empId);
  checkDate(date);
  if (date > todayStr()) fail('You cannot enter attendance for a future date.');
  const old = await getRecord(conn, employeeId, date);
  if (!inTime) {
    await deleteAttendance(conn, employeeId, date);
    await audit(conn, user, 'DELETE', 'attendance', employeeId, notes || `Attendance cleared for ${date}.`, old && { date, in_time: old.inTime, out_time: old.outTime, status: old.dbStatus }, null);
    return {};
  }
  checkTime(inTime, 'Check-in');
  if (outTime) checkTime(outTime, 'Check-out');
  const mins = Number(breakMinutes) || 0;
  const ref = await loadReference(conn);
  const emp = await getEmployee(conn, employeeId, ref);
  const rec = { inTime, outTime: outTime || null, breaks: mins > 0 ? defaultBreak(inTime, mins) : [], method: 'Manual', location: null, notes: notes || `Manual entry by ${user.name}` };
  rec.status = dbStatusForPunches(emp, date, rec, ref);
  await upsertAttendance(conn, user, employeeId, date, rec);
  await audit(conn, user, old ? 'UPDATE' : 'CREATE', 'attendance', employeeId, notes || `Manual attendance for ${date}.`,
    old && { date, in_time: old.inTime, out_time: old.outTime, status: old.dbStatus }, { date, in_time: inTime, out_time: outTime || null, status: rec.status });
  return {};
}

// Mark Present / Absent / Late / Half Day for one or many employees on a date.
export async function markAttendance(conn, user, { date, entries, notes = '' } = {}) {
  need(user, P.ATTENDANCE_EDIT);
  checkDate(date);
  if (date > todayStr()) fail('You cannot mark attendance for a future date.');
  if (!Array.isArray(entries) || !entries.length) fail('No employees selected.');
  for (const { empId, status } of entries) {
    if (!MARKABLE[status]) fail(`Invalid status ${status}.`);
    const employeeId = toEmployeeId(empId);
    const old = await getRecord(conn, employeeId, date);
    const keepTimes = status !== 'ABSENT' && old;
    await upsertAttendance(conn, user, employeeId, date, {
      inTime: keepTimes ? old.inTime : null,
      outTime: keepTimes ? old.outTime : null,
      breaks: keepTimes ? old.breaks : [],
      method: keepTimes && old.inTime ? old.method : 'Manual',
      location: keepTimes ? old.location : null,
      status: MARKABLE[status],
      isManual: true,
      notes: notes || `Marked ${MARKABLE[status]} by ${user.name}`,
    });
  }
  await audit(conn, user, 'MARK', 'attendance', entries.length === 1 ? toEmployeeId(entries[0].empId) : null,
    notes || `Marked attendance for ${entries.length} employee(s) on ${date}.`, null, { date, entries: entries.slice(0, 50) });
  return { count: entries.length };
}
