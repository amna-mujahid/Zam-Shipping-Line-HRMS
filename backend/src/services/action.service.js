// Registry of every state change the frontend can request via POST /api/actions/:name.
// Each action checks permissions against shared/permissions.js, runs inside one
// transaction and writes an audit_log row.
import { withTransaction } from '../config/database.js';
import * as employee from './employee.service.js';
import * as access from './access.service.js';
import * as attendance from './attendance.service.js';
import * as regularization from './regularization.service.js';
import * as leave from './leave.service.js';
import * as organization from './organization.service.js';
import * as payroll from './payroll.service.js';
import * as policy from './policy.service.js';

const actions = { ...employee, ...access, ...attendance, ...regularization, ...leave, ...organization, ...payroll, ...policy };

export const actionNames = Object.keys(actions);

export const runAction = async (name, user, args) => {
  const fn = Object.prototype.hasOwnProperty.call(actions, name) ? actions[name] : null;
  if (typeof fn !== 'function') return { ok: false, error: `Unknown action ${name}.` };
  const result = await withTransaction((conn) => fn(conn, user, ...(Array.isArray(args) ? args : [])));
  return { ok: true, ...result };
};
