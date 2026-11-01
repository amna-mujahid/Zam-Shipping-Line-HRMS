// employees + employee_job_history.
import { pool } from '../config/database.js';
import { fail } from '../utils/errors.js';
import { nullIfEmpty, str } from '../utils/format.js';
import { checkDate } from '../utils/validators.js';
import { roleFromDb, ROLES } from '../shared/roles.js';

const EMPLOYEE_SQL = `
  select e.*, d.department_name, g.designation_name, g.schedule_id,
         u.user_id, u.username, u.is_active as user_active, r.role_name
  from employees e
  left join departments d on d.department_id = e.department_id
  left join designations g on g.designation_id = e.designation_id
  left join users u on u.employee_id = e.employee_id
  left join roles r on r.role_id = u.role_id`;

export const mapEmployee = (row, jobHistory = [], fallbackShiftId = null) => {
  const role = row.role_name ? roleFromDb(row.role_name) : ROLES.EMPLOYEE;
  const separated = ['Inactive', 'Terminated'].includes(row.status);
  return {
    id: `emp-${row.employee_id}`,
    employeeId: row.employee_id,
    empId: String(row.employee_id),
    name: row.employee_name,
    email: str(row.email),
    phone: str(row.phone),
    cnic: str(row.cnic),
    joiningDate: row.joining_date,
    confirmationDate: row.confirmation_date || '',
    grossSalary: Number(row.gross_salary) || 0,
    departmentId: row.department_id,
    department: row.department_name || '—',
    designationId: row.designation_id,
    designation: row.designation_name || '—',
    shiftId: row.schedule_id ? String(row.schedule_id) : fallbackShiftId,
    status: row.status,
    employeeType: row.employee_type || 'Internal',
    managerId: row.manager_id ? String(row.manager_id) : null,
    dob: row.dob || '',
    gender: str(row.gender),
    maritalStatus: str(row.marital_status),
    address: str(row.address),
    personalEmail: str(row.personal_email),
    emergencyContact: { name: str(row.emergency_name), relation: str(row.emergency_relation), phone: str(row.emergency_phone) },
    bank: { bankName: str(row.bank_name), accountNumber: str(row.bank_account), branchCode: str(row.bank_branch_code) },
    officeId: row.office_id || null,
    avatar: '',
    userId: row.user_id || null,
    username: row.username || null,
    hasAccount: !!row.user_id,
    role,
    roleName: row.role_name || null,
    active: !separated && (row.user_id ? !!row.user_active : true),
    accountActive: row.user_id ? !!row.user_active : false,
    jobHistory,
  };
};

export const loadEmployees = async (conn = pool, { onlyEmployeeId = null, fallbackShiftId = null } = {}) => {
  const where = onlyEmployeeId ? ' where e.employee_id = ?' : '';
  const [rows] = await conn.query(`${EMPLOYEE_SQL}${where} order by e.employee_name`, onlyEmployeeId ? [onlyEmployeeId] : []);
  const [hist] = await conn.query(
    `select * from employee_job_history${onlyEmployeeId ? ' where employee_id = ?' : ''} order by event_date, job_history_id`,
    onlyEmployeeId ? [onlyEmployeeId] : []
  );
  const byEmp = {};
  hist.forEach((h) => {
    (byEmp[h.employee_id] ||= []).push({ date: h.event_date, event: h.event, title: h.title, department: h.department || '', note: h.note || '' });
  });
  return rows.map((r) => mapEmployee(r, byEmp[r.employee_id] || [], fallbackShiftId));
};

export const loadActiveEmployees = async (conn, ref) =>
  (await loadEmployees(conn, { fallbackShiftId: ref.shifts[0]?.id || null })).filter((e) => !['Inactive', 'Terminated'].includes(e.status));

export const getEmployee = async (conn, employeeId, ref) => {
  const [emp] = await loadEmployees(conn, { onlyEmployeeId: employeeId, fallbackShiftId: ref.shifts[0]?.id || null });
  if (!emp) fail('Employee not found.');
  return emp;
};

// Fields a department head (attendance only) may see about colleagues.
export const attendanceView = (e) => ({
  id: e.id, employeeId: e.employeeId, empId: e.empId, name: e.name, avatar: '',
  department: e.department, designation: e.designation, shiftId: e.shiftId, status: e.status,
  joiningDate: e.joiningDate, managerId: e.managerId, officeId: e.officeId, active: e.active, role: e.role,
});

// Maps frontend employee fields to employees columns (only keys present in `p`).
export const employeeColumns = (p) => {
  const c = {};
  const set = (key, col, fn = (v) => v) => { if (p[key] !== undefined) c[col] = fn(p[key]); };
  set('name', 'employee_name', (v) => String(v).trim());
  set('email', 'email', nullIfEmpty);
  set('phone', 'phone', (v) => String(v).trim());
  set('cnic', 'cnic', (v) => String(v).trim());
  set('joiningDate', 'joining_date');
  set('confirmationDate', 'confirmation_date', nullIfEmpty);
  set('grossSalary', 'gross_salary', Number);
  set('departmentId', 'department_id', Number);
  set('designationId', 'designation_id', Number);
  set('status', 'status');
  set('employeeType', 'employee_type');
  set('managerId', 'manager_id', (v) => (v ? Number(v) : null));
  set('dob', 'dob', nullIfEmpty);
  set('gender', 'gender', nullIfEmpty);
  set('maritalStatus', 'marital_status', nullIfEmpty);
  set('address', 'address', nullIfEmpty);
  set('personalEmail', 'personal_email', nullIfEmpty);
  set('officeId', 'office_id', nullIfEmpty);
  if (p.emergencyContact) {
    c.emergency_name = nullIfEmpty(p.emergencyContact.name);
    c.emergency_relation = nullIfEmpty(p.emergencyContact.relation);
    c.emergency_phone = nullIfEmpty(p.emergencyContact.phone);
  }
  if (p.bank) {
    c.bank_name = nullIfEmpty(p.bank.bankName);
    c.bank_account = nullIfEmpty(p.bank.accountNumber);
    c.bank_branch_code = nullIfEmpty(p.bank.branchCode);
  }
  if (c.employee_name === '') fail('Name is required.');
  if (c.phone === '') fail('Phone is required.');
  if (c.cnic !== undefined && !/^\d{5}-\d{7}-\d$/.test(c.cnic)) fail('CNIC must be in the format 12345-1234567-1.');
  if (c.gross_salary !== undefined && !(c.gross_salary >= 0)) fail('Salary must be a positive number.');
  if (c.joining_date !== undefined) checkDate(c.joining_date, 'Joining date');
  return c;
};

export const insertEmployee = async (conn, cols) => {
  const [res] = await conn.query('insert into employees set ?', [cols]);
  return cols.employee_id || res.insertId;
};

export const updateEmployeeColumns = (conn, employeeId, cols) =>
  conn.query('update employees set ? where employee_id = ?', [cols, employeeId]);

export const addHistory = (conn, employeeId, date, event, title, department, note) =>
  conn.query(
    'insert into employee_job_history (employee_id, event_date, event, title, department, note) values (?,?,?,?,?,?)',
    [employeeId, date, event, title || '—', department || null, nullIfEmpty(note)]
  );
