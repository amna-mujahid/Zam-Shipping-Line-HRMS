// Role-based access control.
// Owner    – full access to every module (DB role: HR).
// Manager  – attendance (DB role: Department_Head): timesheets, marking, corrections; plus first-level
//            approval of leave for employees who report to them. HR gives the final approval.
// Employee – their own records only (attendance, payslips, leave, profile, policies).
import { ROLES } from './roles';

export const ROLE_LABELS = {
  [ROLES.OWNER]: 'Owner',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.EMPLOYEE]: 'Employee',
};

export const ROLE_BADGE = {
  [ROLES.OWNER]: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  [ROLES.MANAGER]: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  [ROLES.EMPLOYEE]: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

export const PERMISSIONS = {
  // Employee data
  EMPLOYEE_DIRECTORY: 'employee.directory', // view/edit all personnel records
  ORG_CHART: 'employee.orgchart',
  ACCESS_CONTROL: 'admin.access',
  // Attendance
  ATTENDANCE_ALL: 'attendance.all', // see everyone's attendance
  ATTENDANCE_SELF: 'attendance.self',
  ATTENDANCE_EDIT: 'attendance.edit', // manual entries / overrides
  REGULARIZE_APPROVE: 'attendance.regularize.approve',
  REGULARIZE_REQUEST: 'attendance.regularize.request',
  TIME_CLOCK: 'attendance.clock',
  SHIFTS: 'attendance.shifts',
  // Leave
  LEAVE_ALL: 'leave.all', // HR: final approval for everyone
  LEAVE_TEAM: 'leave.team', // Department head: first approval for direct reports
  LEAVE_SELF: 'leave.self',
  // Payroll
  PAYROLL_RUN: 'payroll.run',
  PAYSLIP_SELF: 'payroll.payslip.self',
  // Self-service
  PROFILE_SELF: 'ess.profile',
  POLICIES: 'ess.policies',
  HOLIDAYS: 'calendar.holidays',
  // Reporting & governance
  REPORTS: 'reports.analytics',
  AUDIT_LOG: 'audit.log',
};

const P = PERMISSIONS;

export const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: Object.values(P),
  [ROLES.MANAGER]: [
    P.ATTENDANCE_ALL, P.ATTENDANCE_SELF, P.ATTENDANCE_EDIT,
    P.REGULARIZE_APPROVE, P.TIME_CLOCK, P.LEAVE_TEAM,
  ],
  [ROLES.EMPLOYEE]: [
    P.ATTENDANCE_SELF, P.TIME_CLOCK, P.REGULARIZE_REQUEST,
    P.LEAVE_SELF, P.PAYSLIP_SELF, P.PROFILE_SELF, P.POLICIES, P.HOLIDAYS,
  ],
};

export const hasPermission = (role, permission) => (ROLE_PERMISSIONS[role] || []).includes(permission);

// Every routable view, the permission(s) that unlock it (any-of), and its nav placement.
export const VIEWS = [
  { id: 'dashboard', label: 'Owner Dashboard', icon: 'dashboard', section: 'OVERVIEW', any: [P.REPORTS] },
  { id: 'ess-home', label: 'My Dashboard', icon: 'home', section: 'MY SELF-SERVICE', any: [P.PAYSLIP_SELF], roles: [ROLES.EMPLOYEE] },
  { id: 'time-clock', label: 'Time Clock', icon: 'fingerprint', section: 'TIME & ATTENDANCE', any: [P.TIME_CLOCK], roles: [ROLES.MANAGER, ROLES.EMPLOYEE] },
  { id: 'attendance', label: 'Daily Attendance', icon: 'how_to_reg', section: 'TIME & ATTENDANCE', any: [P.ATTENDANCE_ALL] },
  { id: 'monthly-attendance', label: 'Monthly Timesheet', icon: 'calendar_month', section: 'TIME & ATTENDANCE', any: [P.ATTENDANCE_ALL, P.ATTENDANCE_SELF], selfLabel: 'My Attendance' },
  { id: 'regularization', label: 'Corrections Queue', icon: 'pending_actions', section: 'TIME & ATTENDANCE', any: [P.REGULARIZE_APPROVE, P.REGULARIZE_REQUEST], selfLabel: 'Request Correction', badgeKey: 'pendingRegularizations' },
  { id: 'shifts', label: 'Shifts & Designations', icon: 'schedule', section: 'TIME & ATTENDANCE', any: [P.SHIFTS] },
  { id: 'employees', label: 'Employee Directory', icon: 'badge', section: 'PEOPLE', any: [P.EMPLOYEE_DIRECTORY] },
  { id: 'org-chart', label: 'Organization Chart', icon: 'account_tree', section: 'PEOPLE', any: [P.ORG_CHART] },
  { id: 'access-control', label: 'Roles & Access', icon: 'admin_panel_settings', section: 'PEOPLE', any: [P.ACCESS_CONTROL] },
  { id: 'payroll', label: 'Payroll Processing', icon: 'payments', section: 'PAYROLL', any: [P.PAYROLL_RUN] },
  { id: 'my-payslips', label: 'My Payslips', icon: 'receipt', section: 'MY SELF-SERVICE', any: [P.PAYSLIP_SELF], roles: [ROLES.EMPLOYEE] },
  { id: 'leave', label: 'Leave Management', icon: 'event_available', section: 'LEAVE', any: [P.LEAVE_ALL, P.LEAVE_TEAM, P.LEAVE_SELF], selfLabel: 'My Leave', badgeKey: 'pendingLeaves' },
  { id: 'holidays', label: 'Company Holidays', icon: 'celebration', section: 'LEAVE', any: [P.HOLIDAYS] },
  { id: 'my-profile', label: 'My Profile', icon: 'person', section: 'MY SELF-SERVICE', any: [P.PROFILE_SELF], roles: [ROLES.EMPLOYEE] },
  { id: 'policies', label: 'Company Policies', icon: 'menu_book', section: 'MY SELF-SERVICE', any: [P.POLICIES] },
  { id: 'reports', label: 'Reports & Analytics', icon: 'analytics', section: 'GOVERNANCE', any: [P.REPORTS] },
  { id: 'audit-log', label: 'Audit Trail', icon: 'shield', section: 'GOVERNANCE', any: [P.AUDIT_LOG] },
];

export const canAccessView = (role, viewId) => {
  const v = VIEWS.find((x) => x.id === viewId);
  if (!v) return false;
  if (v.roles && !v.roles.includes(role)) return false;
  return v.any.some((p) => hasPermission(role, p));
};

export const viewsForRole = (role) => VIEWS.filter((v) => canAccessView(role, v.id));

export const DEFAULT_VIEW = {
  [ROLES.OWNER]: 'dashboard',
  [ROLES.MANAGER]: 'attendance',
  [ROLES.EMPLOYEE]: 'ess-home',
};
