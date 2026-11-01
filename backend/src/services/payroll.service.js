// Payroll: finalize / re-open a pay period and edit pay rules (HR only).
import { deletePayrollRun, insertPayrollRun, loadPayrollSettings, payrollRunExists, savePayrollSettings } from '../repositories/payroll.repository.js';
import { loadAttendance } from '../repositories/attendance.repository.js';
import { loadEmployees } from '../repositories/employee.repository.js';
import { loadLeaves } from '../repositories/leave.repository.js';
import { loadReference } from '../repositories/reference.repository.js';
import { audit } from '../repositories/audit.repository.js';
import { engineCtx } from '../utils/attendanceEngine.js';
import { fail } from '../utils/errors.js';
import { checkMonth, need } from '../utils/validators.js';
import { PERMISSIONS as P } from '../../../shared/permissions';
import { computePayrollRun } from '../../../shared/payroll';
import { periodEnd, periodStart } from '../../../shared/dates';

export async function finalizePayroll(conn, user, monthKey) {
  need(user, P.PAYROLL_RUN);
  checkMonth(monthKey);
  if (await payrollRunExists(conn, monthKey)) fail('Payroll for this month is already finalized.');
  const ref = await loadReference(conn);
  const employees = await loadEmployees(conn, { fallbackShiftId: ref.shifts[0]?.id || null });
  const records = await loadAttendance(conn, { from: periodStart(monthKey), to: periodEnd(monthKey) });
  const leaves = await loadLeaves(conn, { approvedOnly: true });
  const settings = await loadPayrollSettings(conn);
  const payslips = computePayrollRun(employees, monthKey, engineCtx(ref, records, leaves), settings);
  await insertPayrollRun(conn, monthKey, user.userId, payslips);
  const net = payslips.reduce((a, p) => a + p.netPay, 0);
  await audit(conn, user, 'FINALIZE', 'payroll_run', null, `Payroll ${monthKey} finalized for ${payslips.length} employees. Net Rs ${net.toFixed(2)}.`, { status: 'DRAFT' }, { status: 'FINALIZED', month: monthKey });
  return { count: payslips.length };
}

export async function reopenPayroll(conn, user, monthKey) {
  need(user, P.PAYROLL_RUN);
  await deletePayrollRun(conn, monthKey);
  await audit(conn, user, 'UPDATE', 'payroll_run', null, `Payroll ${monthKey} re-opened; payslips withdrawn.`, { status: 'FINALIZED', month: monthKey }, { status: 'DRAFT' });
  return {};
}

export async function updatePayrollSettings(conn, user, patch) {
  need(user, P.PAYROLL_RUN);
  const current = await loadPayrollSettings(conn);
  await savePayrollSettings(conn, { ...current, ...patch });
  await audit(conn, user, 'UPDATE', 'app_settings', null, 'Payroll rules updated.', null, patch);
  return {};
}
