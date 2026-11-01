// Everything the frontend needs after sign-in, scoped by role —
// data a role may not see never leaves the server.
import { pool } from '../config/database.js';
import { loadReference } from '../repositories/reference.repository.js';
import { attendanceView, loadEmployees } from '../repositories/employee.repository.js';
import { loadAttendance, loadRegularizations } from '../repositories/attendance.repository.js';
import { loadLeaves } from '../repositories/leave.repository.js';
import { loadPayrollRuns, loadPayrollSettings } from '../repositories/payroll.repository.js';
import { loadPolicyAcks } from '../repositories/policy.repository.js';
import { loadAuditLogs } from '../repositories/audit.repository.js';
import { ROLES } from '../../../shared/roles';
import { monthKeyOf, periodStart, shiftMonth, todayStr } from '../../../shared/dates';

// Attendance history sent to the browser: the current pay period plus the previous six.
export const historyStart = () => periodStart(shiftMonth(monthKeyOf(todayStr()), -6));

const ownerState = async (conn, user, base, { fallbackShiftId, from }) => ({
  ...base,
  employees: await loadEmployees(conn, { fallbackShiftId }),
  records: await loadAttendance(conn, { from }),
  leaves: await loadLeaves(conn),
  regularizations: await loadRegularizations(conn),
  payrollRuns: await loadPayrollRuns(conn),
  auditLogs: await loadAuditLogs(conn),
});

// Attendance only: colleagues' attendance fields, approved leave dates (needed to show
// "On Leave"), corrections. No salary, personal, payroll or audit data.
const managerState = async (conn, user, base, { fallbackShiftId, from }) => {
  const all = await loadEmployees(conn, { fallbackShiftId });
  const approved = await loadLeaves(conn, { approvedOnly: true });
  // Full details only for requests of the manager's own direct reports (first-level approval).
  const team = await loadLeaves(conn, { teamOfEmployeeId: user.employeeId });
  const teamIds = new Set(team.map((l) => l.id));
  const minimal = approved
    .filter((l) => !teamIds.has(l.id))
    .map(({ id, empId, leaveTypeId, leaveType, fromDate, toDate, status }) => ({ id, empId, leaveTypeId, leaveType, fromDate, toDate, status, minimal: true }));
  return {
    ...base,
    payrollSettings: null,
    employees: all.map((e) => (e.empId === user.empId ? e : attendanceView(e))),
    records: await loadAttendance(conn, { from }),
    leaves: [...team, ...minimal],
    regularizations: await loadRegularizations(conn),
    payrollRuns: {},
    auditLogs: [],
  };
};

// Employee: own records only (plus their manager's name for display).
const employeeState = async (conn, user, base, { fallbackShiftId, from }) => {
  const [self] = await loadEmployees(conn, { onlyEmployeeId: user.employeeId, fallbackShiftId });
  const employees = [self];
  if (self?.managerId) {
    const [mgr] = await loadEmployees(conn, { onlyEmployeeId: Number(self.managerId), fallbackShiftId });
    if (mgr) employees.push({ id: mgr.id, empId: mgr.empId, name: mgr.name, designation: mgr.designation, department: mgr.department, active: mgr.active, avatar: '', minimal: true });
  }
  const runs = await loadPayrollRuns(conn, { employeeId: user.employeeId });
  return {
    ...base,
    employees,
    records: await loadAttendance(conn, { from, employeeId: user.employeeId }),
    leaves: await loadLeaves(conn, { employeeId: user.employeeId }),
    regularizations: await loadRegularizations(conn, { employeeId: user.employeeId }),
    payrollRuns: Object.fromEntries(Object.entries(runs).filter(([, r]) => r.status === 'FINALIZED')),
    auditLogs: [],
  };
};

const BY_ROLE = { [ROLES.OWNER]: ownerState, [ROLES.MANAGER]: managerState };

export const buildState = async (user) => {
  const conn = pool;
  const ref = await loadReference(conn);
  const opts = { fallbackShiftId: ref.shifts[0]?.id || null, from: historyStart() };
  const base = {
    ...ref,
    me: user,
    payrollSettings: await loadPayrollSettings(conn),
    policyAcks: await loadPolicyAcks(conn, user.employeeId),
    serverToday: todayStr(),
  };
  return (BY_ROLE[user.role] || employeeState)(conn, user, base, opts);
};
