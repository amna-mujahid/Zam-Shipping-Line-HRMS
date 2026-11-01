// payroll_run + app_settings('payroll').
import { pool } from '../config/database.js';
import { DEFAULT_PAYROLL_SETTINGS } from '../shared/payroll';

export const loadPayrollSettings = async (conn = pool) => {
  const [[row]] = await conn.query("select setting_value from app_settings where setting_key = 'payroll'");
  return { ...DEFAULT_PAYROLL_SETTINGS, ...(row?.setting_value || {}) };
};

export const savePayrollSettings = (conn, settings) =>
  conn.query(
    "insert into app_settings (setting_key, setting_value) values ('payroll', ?) on duplicate key update setting_value = values(setting_value)",
    [JSON.stringify(settings)]
  );

export const loadPayrollRuns = async (conn, { employeeId = null } = {}) => {
  const [rows] = await conn.query(
    `select pr.*, e.employee_name from payroll_run pr
     left join users u on u.user_id = pr.finalized_by
     left join employees e on e.employee_id = u.employee_id`
  );
  const runs = {};
  rows.forEach((r) => {
    const slips = Array.isArray(r.payslips) ? r.payslips : [];
    runs[r.month_key] = {
      status: r.status,
      finalizedAt: String(r.finalized_at).slice(0, 10),
      finalizedBy: r.employee_name || '—',
      payslips: employeeId ? slips.filter((p) => p.empId === String(employeeId)) : slips,
    };
  });
  return runs;
};

export const payrollRunExists = async (conn, monthKey) => {
  const [[row]] = await conn.query('select 1 as x from payroll_run where month_key = ?', [monthKey]);
  return !!row;
};

export const insertPayrollRun = (conn, monthKey, userId, payslips) =>
  conn.query("insert into payroll_run (month_key, status, finalized_by, payslips) values (?, 'FINALIZED', ?, ?)", [monthKey, userId, JSON.stringify(payslips)]);

export const deletePayrollRun = (conn, monthKey) => conn.query('delete from payroll_run where month_key = ?', [monthKey]);
