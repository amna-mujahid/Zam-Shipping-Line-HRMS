// Access control: login accounts, roles, activation and password resets (HR only).
import { findUserByEmployee, insertUser, roleIdFor, setUserActiveByEmployee, updatePasswordHash, updateUserRole } from '../repositories/user.repository.js';
import { audit } from '../repositories/audit.repository.js';
import { fail } from '../utils/errors.js';
import { hashPassword } from '../utils/password.js';
import { need, toEmployeeId } from '../utils/validators.js';
import { PERMISSIONS as P } from '../../../shared/permissions';
import { ROLES } from '../../../shared/roles';

export async function setEmployeeRole(conn, user, empId, appRole) {
  need(user, P.ACCESS_CONTROL);
  const employeeId = toEmployeeId(empId);
  if (employeeId === user.employeeId) fail('You cannot change your own role.');
  const u = await findUserByEmployee(conn, employeeId);
  if (!u) fail('This employee has no login account. Create one with "Set password" first.');
  const roleId = await roleIdFor(conn, appRole);
  await updateUserRole(conn, u.user_id, roleId);
  await audit(conn, user, 'UPDATE', 'users', u.user_id, `Changed access role of employee ${employeeId}.`, { role: u.role_name }, { role_id: roleId });
  return {};
}

export async function setEmployeeActive(conn, user, empId, active) {
  need(user, P.ACCESS_CONTROL);
  const employeeId = toEmployeeId(empId);
  if (employeeId === user.employeeId) fail('You cannot deactivate your own account.');
  if (!(await setUserActiveByEmployee(conn, employeeId, active))) fail('This employee has no login account.');
  await audit(conn, user, 'UPDATE', 'users', employeeId, active ? 'Login account activated.' : 'Login account deactivated.', { is_active: !active }, { is_active: !!active });
  return {};
}

// Sets a password, creating the login account (username = employee ID) if needed.
export async function resetPassword(conn, user, empId, password, username) {
  need(user, P.ACCESS_CONTROL);
  const employeeId = toEmployeeId(empId);
  if (!password || String(password).length < 4) fail('Password must be at least 4 characters.');
  const hash = await hashPassword(String(password));
  const u = await findUserByEmployee(conn, employeeId);
  if (u) {
    await updatePasswordHash(u.user_id, hash, conn);
    await audit(conn, user, 'UPDATE', 'users', u.user_id, 'Password reset by HR.');
    return { created: false };
  }
  const name = String(username || employeeId).trim();
  const userId = await insertUser(conn, { employeeId, username: name, hash, roleId: await roleIdFor(conn, ROLES.EMPLOYEE) });
  await audit(conn, user, 'CREATE', 'users', userId, `Login account created for employee ${employeeId}.`);
  return { created: true, username: String(username || employeeId) };
}
