// Input checks shared by the services. Each throws an ActionError with a readable message.
import { fail } from './errors.js';
import { hasPermission } from '../../../shared/permissions';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export const need = (user, perm) => {
  if (!hasPermission(user.role, perm)) fail('You do not have permission to perform this action.');
};

export const checkDate = (d, label = 'Date') => {
  if (!DATE_RE.test(d || '')) fail(`${label} is invalid.`);
};

export const checkTime = (t, label = 'Time') => {
  if (!TIME_RE.test(t || '')) fail(`${label} is invalid.`);
};

export const checkMonth = (m) => {
  if (!MONTH_RE.test(m || '')) fail('Invalid month.');
};

export const toEmployeeId = (empId) => {
  const n = Number(empId);
  if (!Number.isInteger(n) || n <= 0) fail('Invalid employee.');
  return n;
};
