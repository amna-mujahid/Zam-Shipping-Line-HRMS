// Employee directory: onboarding, updates (with job history) and self-service profile edits.
import { addHistory, employeeColumns, getEmployee, insertEmployee, updateEmployeeColumns } from '../repositories/employee.repository.js';
import { loadReference, lookupName } from '../repositories/reference.repository.js';
import { insertUser, roleIdFor } from '../repositories/user.repository.js';
import { audit } from '../repositories/audit.repository.js';
import { fail } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { need, toEmployeeId } from '../utils/validators.js';
import { PERMISSIONS as P } from '../shared/permissions.js';
import { ROLES } from '../shared/roles.js';
import { todayStr } from '../shared/dates.js';

const designationName = (conn, id) => lookupName(conn, 'designations', 'designation_id', 'designation_name', id);
const departmentName = (conn, id) => lookupName(conn, 'departments', 'department_id', 'department_name', id);
const SEPARATED = ['Inactive', 'Terminated'];

export async function addEmployee(conn, user, data) {
  need(user, P.EMPLOYEE_DIRECTORY);
  const cols = employeeColumns({ ...data, status: data.status || 'Probation', employeeType: data.employeeType || 'Internal' });
  for (const k of ['employee_name', 'phone', 'cnic', 'joining_date', 'gross_salary', 'department_id', 'designation_id']) {
    if (cols[k] === undefined || cols[k] === null || Number.isNaN(cols[k])) fail('Name, phone, CNIC, joining date, salary, department and designation are required.');
  }
  if (data.empId) cols.employee_id = toEmployeeId(data.empId);
  const employeeId = await insertEmployee(conn, cols);
  const title = await designationName(conn, cols.designation_id);
  const dept = await departmentName(conn, cols.department_id);
  await addHistory(conn, employeeId, cols.joining_date, 'Joined', title, dept, 'Onboarded');
  if (data.password) {
    await insertUser(conn, {
      employeeId,
      username: String(data.username || employeeId).trim(),
      hash: await hashPassword(data.password),
      roleId: await roleIdFor(conn, data.role || ROLES.EMPLOYEE),
    });
  }
  await audit(conn, user, 'CREATE', 'employees', employeeId, `Onboarded ${cols.employee_name} as ${title}.`, null, { department: dept, status: cols.status, login: !!data.password });
  return { empId: String(employeeId) };
}

export async function updateEmployee(conn, user, empId, patch, note = '') {
  need(user, P.EMPLOYEE_DIRECTORY);
  const employeeId = toEmployeeId(empId);
  const ref = await loadReference(conn);
  const old = await getEmployee(conn, employeeId, ref);
  if (patch.managerId && String(patch.managerId) === old.empId) fail('An employee cannot report to themselves.');
  const cols = employeeColumns(patch);
  delete cols.employee_id;
  const today = todayStr();
  const newTitle = patch.designationId ? await designationName(conn, patch.designationId) : old.designation;
  const newDept = patch.departmentId ? await departmentName(conn, patch.departmentId) : old.department;
  if (cols.status === 'Permanent' && old.status === 'Probation' && !old.confirmationDate && !cols.confirmation_date) cols.confirmation_date = today;

  const before = {
    employee_name: old.name, email: old.email || null, phone: old.phone, cnic: old.cnic, joining_date: old.joiningDate,
    confirmation_date: old.confirmationDate || null, gross_salary: old.grossSalary, department_id: old.departmentId,
    designation_id: old.designationId, status: old.status, employee_type: old.employeeType, manager_id: old.managerId ? Number(old.managerId) : null,
  };
  const changed = Object.entries(cols).filter(([k, v]) => before[k] === undefined || String(before[k] ?? '') !== String(v ?? ''));
  if (!changed.length) return {};
  await updateEmployeeColumns(conn, employeeId, Object.fromEntries(changed));

  if (newDept !== old.department) await addHistory(conn, employeeId, today, 'Transfer', newTitle, newDept, note);
  else if (newTitle !== old.designation) await addHistory(conn, employeeId, today, 'Promotion', newTitle, newDept, note);
  if (cols.gross_salary !== undefined && cols.gross_salary !== old.grossSalary) {
    await addHistory(conn, employeeId, today, 'Salary Revision', newTitle, newDept, `Rs ${old.grossSalary.toLocaleString()} → Rs ${cols.gross_salary.toLocaleString()}${note ? ` • ${note}` : ''}`);
  }
  if (cols.status === 'Permanent' && old.status === 'Probation') await addHistory(conn, employeeId, today, 'Confirmed', newTitle, newDept, 'Probation completed');
  if (SEPARATED.includes(cols.status) && !SEPARATED.includes(old.status)) await addHistory(conn, employeeId, today, cols.status, newTitle, newDept, note);

  const hide = (k) => (k.startsWith('bank_') ? '••••' : null);
  await audit(conn, user, 'UPDATE', 'employees', employeeId, note || `Updated ${changed.map(([k]) => k).join(', ')} for ${old.name}.`,
    Object.fromEntries(changed.map(([k]) => [k, hide(k) ?? null])),
    Object.fromEntries(changed.map(([k, v]) => [k, hide(k) ?? v])));
  return {};
}

export async function updateOwnProfile(conn, user, patch) {
  need(user, P.PROFILE_SELF);
  const allowed = ['phone', 'personalEmail', 'address', 'maritalStatus', 'emergencyContact', 'bank'];
  const clean = Object.fromEntries(Object.entries(patch || {}).filter(([k]) => allowed.includes(k)));
  if (clean.phone !== undefined && !String(clean.phone).trim()) fail('Mobile phone cannot be empty.');
  const cols = employeeColumns(clean);
  if (!Object.keys(cols).length) return {};
  await updateEmployeeColumns(conn, user.employeeId, cols);
  await audit(conn, user, 'UPDATE', 'employees', user.employeeId, `Self-service update: ${Object.keys(clean).join(', ')}.`, null,
    Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, k.startsWith('bank_') ? '••••' : v])));
  return {};
}
