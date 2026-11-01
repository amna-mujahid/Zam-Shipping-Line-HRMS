// Attendance corrections: an employee requests new times, HR / department head decides.
import {
  findRegularizationForUpdate, getRecord, hasPendingRegularization, insertRegularization, setRegularizationDecision, upsertAttendance,
} from '../repositories/attendance.repository.js';
import { getEmployee } from '../repositories/employee.repository.js';
import { getCalendarId, loadReference } from '../repositories/reference.repository.js';
import { audit } from '../repositories/audit.repository.js';
import { dbStatusForPunches } from '../utils/attendanceEngine.js';
import { fail } from '../utils/errors.js';
import { hm, nullIfEmpty } from '../utils/format.js';
import { checkDate, checkTime, need } from '../utils/validators.js';
import { PERMISSIONS as P } from '../shared/permissions.js';
import { todayStr } from '../shared/dates.js';

export async function submitRegularization(conn, user, { date, requestedIn, requestedOut, reason } = {}) {
  need(user, P.REGULARIZE_REQUEST);
  checkDate(date);
  checkTime(requestedIn, 'Check-in');
  if (requestedOut) checkTime(requestedOut, 'Check-out');
  if (!String(reason || '').trim()) fail('Reason is required.');
  if (date > todayStr()) fail('You cannot regularize a future date.');
  const calendarId = await getCalendarId(conn, date);
  if (await hasPendingRegularization(conn, user.employeeId, calendarId)) fail('A pending request already exists for this date.');
  const rec = await getRecord(conn, user.employeeId, date);
  const id = await insertRegularization(conn, {
    employeeId: user.employeeId, calendarId, requestedIn, requestedOut: requestedOut || null,
    reason: String(reason).slice(0, 255), originalIn: rec?.inTime || null, originalOut: rec?.outTime || null,
  });
  await audit(conn, user, 'CREATE', 'attendance_request', id, reason, null, { date, requested_in: requestedIn, requested_out: requestedOut });
  return { reqCode: `REG-${id}` };
}

export async function decideRegularization(conn, user, id, approve, comment = '') {
  need(user, P.REGULARIZE_APPROVE);
  const req = await findRegularizationForUpdate(conn, Number(id));
  if (!req || req.hr_status !== 'Pending') fail('Request is no longer pending.');
  if (req.employee_id === user.employeeId) fail('You cannot approve your own request.');
  await setRegularizationDecision(conn, req.attendance_request_id, {
    status: approve ? 'Approved' : 'Rejected',
    hrId: user.userId,
    remarks: nullIfEmpty(String(comment || '').slice(0, 255)),
    verifiedIn: approve ? req.updated_in_time : null,
  });
  if (approve) {
    const date = req.calendar_date;
    const ref = await loadReference(conn);
    const emp = await getEmployee(conn, req.employee_id, ref);
    const old = await getRecord(conn, req.employee_id, date);
    const rec = {
      inTime: hm(req.updated_in_time),
      outTime: hm(req.updated_out_time) || old?.outTime || null,
      breaks: old?.breaks || [],
      method: old?.method && old.method !== 'Manual' ? old.method : 'Regularized',
      location: old?.location || null,
      notes: `Regularized (REG-${req.attendance_request_id}): ${req.reason}`,
    };
    rec.status = dbStatusForPunches(emp, date, rec, ref);
    await upsertAttendance(conn, user, req.employee_id, date, rec);
  }
  await audit(conn, user, approve ? 'APPROVE' : 'REJECT', 'attendance_request', req.attendance_request_id, comment || req.reason, { hr_status: 'Pending' }, { hr_status: approve ? 'Approved' : 'Rejected' });
  return {};
}
