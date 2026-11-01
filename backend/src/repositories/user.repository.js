// users + roles (login accounts).
import { pool } from '../config/database.js';
import { fail } from '../utils/errors.js';
import { ROLES } from '../shared/roles.js';

const USER_SQL = `
  select u.user_id, u.employee_id, u.username, u.hash_password, u.is_active, r.role_name,
         e.employee_name, e.status as employee_status
  from users u
  join roles r on r.role_id = u.role_id
  join employees e on e.employee_id = u.employee_id`;

// `login` is matched against the username or the employee's email, case-insensitively.
export const findUserByLogin = async (login, conn = pool) => {
  const [rows] = await conn.query(`${USER_SQL} where lower(u.username) = ? or lower(e.email) = ? limit 1`, [login, login]);
  return rows[0] || null;
};

export const findUserById = async (userId, conn = pool) => {
  const [rows] = await conn.query(`${USER_SQL} where u.user_id = ?`, [userId]);
  return rows[0] || null;
};

export const findUserByEmployee = async (conn, employeeId) => {
  const [[u]] = await conn.query('select u.user_id, r.role_name from users u join roles r on r.role_id = u.role_id where u.employee_id = ?', [employeeId]);
  return u || null;
};

export const updatePasswordHash = (userId, hash, conn = pool) =>
  conn.query('update users set hash_password = ? where user_id = ?', [hash, userId]);

export const updateUserRole = (conn, userId, roleId) => conn.query('update users set role_id = ? where user_id = ?', [roleId, userId]);

export const setUserActiveByEmployee = async (conn, employeeId, active) => {
  const [res] = await conn.query('update users set is_active = ? where employee_id = ?', [active ? 1 : 0, employeeId]);
  return res.affectedRows;
};

export const insertUser = async (conn, { employeeId, username, hash, roleId }) => {
  const [res] = await conn.query('insert into users (employee_id, username, hash_password, role_id, is_active) values (?,?,?,?,1)', [employeeId, username, hash, roleId]);
  return res.insertId;
};

// roles.role_id for an app role (HR → owner, Department_Head → manager, Employee → employee).
export const roleIdFor = async (conn, appRole) => {
  const preferred = { [ROLES.OWNER]: ['HR', 'Owner'], [ROLES.MANAGER]: ['Department_Head', 'Manager'], [ROLES.EMPLOYEE]: ['Employee'] }[appRole];
  if (!preferred) fail('Unknown role.');
  const [rows] = await conn.query('select role_id, role_name from roles');
  const hit = preferred.map((n) => rows.find((r) => r.role_name === n)).find(Boolean);
  if (!hit) fail(`Role "${preferred[0]}" does not exist in the roles table.`);
  return hit.role_id;
};
