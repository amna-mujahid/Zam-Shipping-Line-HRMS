// Sign-in: username + password only. The role (HR / Department Head / Employee) is
// read from the account's row in the database and decides what the user can open.
import { findUserById, findUserByLogin, updatePasswordHash } from '../repositories/user.repository.js';
import { hashPassword, isBcrypt, verifyPassword } from '../utils/password.js';
import { signToken, verifyToken } from '../utils/token.js';
import { roleFromDb } from '../shared/roles.js';

export const toSessionUser = (row) => ({
  userId: row.user_id,
  employeeId: row.employee_id,
  empId: String(row.employee_id),
  username: row.username,
  name: row.employee_name,
  role: roleFromDb(row.role_name),
  dbRole: row.role_name,
});

const isUsable = (row) => row && row.is_active && !['Inactive', 'Terminated'].includes(row.employee_status);

// Simple in-memory brute-force guard: 8 failures per username per 5 minutes.
const WINDOW_MS = 5 * 60 * 1000;
const failures = new Map();
const tooMany = (key) => {
  const f = failures.get(key);
  return f && f.count >= 8 && Date.now() - f.first < WINDOW_MS;
};
const recordFailure = (key) => {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > WINDOW_MS) failures.set(key, { count: 1, first: Date.now() });
  else f.count += 1;
};

export const login = async (username, password) => {
  const key = String(username || '').trim().toLowerCase();
  if (!key || !password) return { ok: false, error: 'Enter your username and password.' };
  if (tooMany(key)) return { ok: false, error: 'Too many failed attempts. Try again in 5 minutes.' };

  const row = await findUserByLogin(key);
  const valid = row && (await verifyPassword(password, row.hash_password));
  if (!valid) {
    recordFailure(key);
    return { ok: false, error: 'Invalid username or password.' };
  }
  if (!isUsable(row)) return { ok: false, error: 'This account is inactive. Contact HR.' };
  failures.delete(key);
  if (!isBcrypt(row.hash_password)) await updatePasswordHash(row.user_id, await hashPassword(password));
  return { ok: true, token: signToken(row.user_id), user: toSessionUser(row) };
};

// Resolves a bearer token to the current user. Loaded fresh on every request so role
// or deactivation changes take effect immediately. Returns { user } or { error }.
export const authenticate = async (token) => {
  const payload = verifyToken(token);
  if (!payload) return { error: 'Your session has expired. Please sign in again.' };
  const row = await findUserById(payload.uid);
  if (!isUsable(row)) return { error: 'This account is inactive.' };
  return { user: toSessionUser(row) };
};
