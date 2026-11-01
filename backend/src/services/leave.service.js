// Leave: apply, department-head first approval, HR final approval, cancel.
import {
  deleteLeaveRequest, findLeaveRequest, insertLeaveRequest, insertLeaveTransaction, leaveTypeName, loadLeaves, setHrDecision, setManagerDecision,
} from '../repositories/leave.repository.js';
import { getRecord, upsertAttendance } from '../repositories/attendance.repository.js';
import { getEmployee } from '../repositories/employee.repository.js';
import { loadReference } from '../repositories/reference.repository.js';
import { audit } from '../repositories/audit.repository.js';
import { engineCtx } from '../utils/attendanceEngine.js';
import { fail } from '../utils/errors.js';
import { checkDate, need } from '../utils/validators.js';
import { PERMISSIONS as P } from '../shared/permissions.js';
import { DB_STATUS, findHoliday, isOffDay } from '../shared/attendance.js';
import { countWorkingDays, leaveBalancesFor } from '../shared/leave.js';
import { dateRange, todayStr } from '../shared/dates.js';

export async function submitLeave(conn, user, { leaveTypeId, fromDate, toDate, reason } = {}) {
  need(user, P.LEAVE_SELF);
  checkDate(fromDate, 'From date');
  checkDate(toDate, 'To date');
  if (toDate < fromDate) fail('End date must be on or after start date.');
  if (!String(reason || '').trim()) fail('Reason is required.');
  const ref = await loadReference(conn);
  const type = ref.leaveTypes.find((t) => t.id === Number(leaveTypeId));
  if (!type) fail('Unknown leave type.');
  const ctx = engineCtx(ref);
  const days = countWorkingDays(fromDate, toDate, ctx);
  if (!days) fail('Selected range has no working days.');
  const leaves = await loadLeaves(conn, { employeeId: user.employeeId });
  if (leaves.some((l) => l.status !== 'Rejected' && fromDate <= l.toDate && toDate >= l.fromDate)) fail('This overlaps an existing leave request.');
  const emp = await getEmployee(conn, user.employeeId, ref);
  const bal = leaveBalancesFor(emp, leaves, ref.leaveTypes, ctx, fromDate.slice(0, 4), todayStr()).find((b) => b.typeId === type.id);
  if (bal && days > bal.available) fail(`Insufficient ${type.name} balance (${bal.available} day(s) available).`);
  const id = await insertLeaveRequest(conn, { employeeId: user.employeeId, leaveTypeId: type.id, fromDate, toDate, days, reason: String(reason).slice(0, 255) });
  await audit(conn, user, 'CREATE', 'leave_request', id, `${days} day(s) ${type.name}: ${reason}`);
  return { days, reqCode: `LR-${id}` };
}

// Writes every working day of an approved leave into attendance as 'On Leave',
// so timesheets and payroll pick it up automatically. Real punches are kept.
const markLeaveDays = async (conn, user, req) => {
  const ref = await loadReference(conn);
  const ctx = engineCtx(ref);
  const typeName = (await leaveTypeName(conn, req.leave_type_id)) || 'Leave';
  let count = 0;
  for (const date of dateRange(req.from_date, req.to_date)) {
    if (isOffDay(ctx, date) || findHoliday(ref.holidays, date)) continue;
    const old = await getRecord(conn, req.employee_id, date);
    if (old?.inTime && !old.isManual) continue;
    await upsertAttendance(conn, user, req.employee_id, date, {
      inTime: null, outTime: null, breaks: [], method: 'Leave', location: null,
      status: DB_STATUS.ON_LEAVE, isManual: true, notes: `LR-${req.leave_request_id} ${typeName}`,
    });
    count += 1;
  }
  return count;
};

// Final decision (HR).
export async function decideLeave(conn, user, id, approve, comment = '') {
  need(user, P.LEAVE_ALL);
  const req = await findLeaveRequest(conn, Number(id), { forUpdate: true });
  if (!req || req.hr_status !== 'Pending') fail('Request is no longer pending.');
  if (req.employee_id === user.employeeId) fail('You cannot approve your own leave.');
  const status = approve ? 'Approved' : 'Rejected';
  await setHrDecision(conn, req.leave_request_id, { status, hrId: user.userId, approvedDays: approve ? req.total_days : null });
  let leaveDays = 0;
  if (approve) {
    await insertLeaveTransaction(conn, {
      employeeId: req.employee_id, leaveTypeId: req.leave_type_id, leaveRequestId: req.leave_request_id,
      days: -req.total_days, remarks: `Approved LR-${req.leave_request_id}`,
    });
    leaveDays = await markLeaveDays(conn, user, req);
  }
  await audit(conn, user, approve ? 'APPROVE' : 'REJECT', 'leave_request', req.leave_request_id, comment || req.reason || '',
    { hr_status: 'Pending' }, { hr_status: status, attendance_days_marked: leaveDays });
  return { leaveDays };
}

// First-level decision by the department head the employee reports to. HR still decides finally.
export async function managerDecideLeave(conn, user, id, approve, comment = '') {
  need(user, P.LEAVE_TEAM);
  const req = await findLeaveRequest(conn, Number(id), { forUpdate: true, withReportsTo: true });
  if (!req) fail('Leave request not found.');
  if (req.reports_to_id !== user.employeeId) fail('You can only decide leave for employees who report to you.');
  if (req.hr_status !== 'Pending') fail('HR has already decided this request.');
  if (req.manager_status !== 'Pending') fail('You have already decided this request.');
  const status = approve ? 'Approved' : 'Rejected';
  await setManagerDecision(conn, req.leave_request_id, { status, managerId: user.userId });
  await audit(conn, user, approve ? 'APPROVE' : 'REJECT', 'leave_request', req.leave_request_id,
    `Department head ${approve ? 'approved' : 'rejected'}${comment ? `: ${comment}` : ''} — forwarded to HR.`, { manager_status: 'Pending' }, { manager_status: status });
  return {};
}

export async function cancelLeave(conn, user, id) {
  need(user, P.LEAVE_SELF);
  const req = await findLeaveRequest(conn, Number(id));
  if (!req || req.employee_id !== user.employeeId || req.hr_status !== 'Pending') fail('Only your own pending requests can be cancelled.');
  await deleteLeaveRequest(conn, req.leave_request_id);
  await audit(conn, user, 'DELETE', 'leave_request', req.leave_request_id, 'Cancelled by employee.', { from_date: req.from_date, to_date: req.to_date }, null);
  return {};
}
