// Org setup: holidays, departments, designations and schedules (shift timings).
import {
  deleteHoliday, findHolidayById, getCalendarId, insertDepartment, insertDesignation, insertHoliday, insertSchedule, updateDesignationSchedule, updateSchedule,
} from '../repositories/reference.repository.js';
import { audit } from '../repositories/audit.repository.js';
import { fail } from '../utils/errors.js';
import { nullIfEmpty } from '../utils/format.js';
import { checkDate, checkTime, need } from '../utils/validators.js';
import { PERMISSIONS as P } from '../shared/permissions';

// ---- holidays ---------------------------------------------------------------

export async function addHoliday(conn, user, { name, fromDate, toDate } = {}) {
  need(user, P.EMPLOYEE_DIRECTORY);
  if (!String(name || '').trim()) fail('Holiday name is required.');
  checkDate(fromDate, 'From date');
  checkDate(toDate, 'To date');
  if (toDate < fromDate) fail('End date must be on or after start date.');
  for (const d of [fromDate, toDate]) await getCalendarId(conn, d); // make sure the range exists in calendar
  const id = await insertHoliday(conn, String(name).trim(), fromDate, toDate);
  await audit(conn, user, 'CREATE', 'holiday', id, `${name}: ${fromDate} – ${toDate}`);
  return {};
}

export async function removeHoliday(conn, user, id) {
  need(user, P.EMPLOYEE_DIRECTORY);
  const h = await findHolidayById(conn, Number(id));
  if (!h) fail('Holiday not found.');
  await deleteHoliday(conn, h.holiday_id);
  await audit(conn, user, 'DELETE', 'holiday', h.holiday_id, `${h.holiday_name} removed.`, { holiday_name: h.holiday_name }, null);
  return {};
}

// ---- departments & designations ---------------------------------------------

export async function addDepartment(conn, user, name) {
  need(user, P.SHIFTS);
  if (!String(name || '').trim()) fail('Department name is required.');
  const id = await insertDepartment(conn, String(name).trim());
  await audit(conn, user, 'CREATE', 'departments', id, `Department ${name} created.`);
  return {};
}

export async function addDesignation(conn, user, { name, scheduleId } = {}) {
  need(user, P.SHIFTS);
  if (!String(name || '').trim()) fail('Designation name is required.');
  const id = await insertDesignation(conn, String(name).trim(), scheduleId ? Number(scheduleId) : null);
  await audit(conn, user, 'CREATE', 'designations', id, `Designation ${name} created.`);
  return {};
}

export async function setDesignationSchedule(conn, user, designationId, scheduleId) {
  need(user, P.SHIFTS);
  await updateDesignationSchedule(conn, Number(designationId), scheduleId ? Number(scheduleId) : null);
  await audit(conn, user, 'UPDATE', 'designations', Number(designationId), 'Schedule assignment changed.', null, { schedule_id: scheduleId || null });
  return {};
}

// ---- schedules --------------------------------------------------------------

export async function saveSchedule(conn, user, s = {}) {
  need(user, P.SHIFTS);
  if (!String(s.name || '').trim()) fail('Schedule name is required.');
  ['reportingTime', 'lateAfter', 'halfDayAfter', 'normalOutTime'].forEach((k) => checkTime(s[k], k));
  if (!(s.reportingTime <= s.lateAfter && s.lateAfter <= s.halfDayAfter)) fail('Times must be in order: reporting ≤ late after ≤ half day after.');
  const cols = {
    schedule_name: String(s.name).trim(), reporting_time: s.reportingTime, late_after: s.lateAfter,
    half_day_after: s.halfDayAfter, normal_out_time: s.normalOutTime, remarks: nullIfEmpty(s.remarks),
  };
  if (s.id) {
    await updateSchedule(conn, Number(s.id), cols);
    await audit(conn, user, 'UPDATE', 'schedule', Number(s.id), `Schedule ${cols.schedule_name} updated.`, null, cols);
  } else {
    const id = await insertSchedule(conn, cols);
    await audit(conn, user, 'CREATE', 'schedule', id, `Schedule ${cols.schedule_name} created.`, null, cols);
  }
  return {};
}
