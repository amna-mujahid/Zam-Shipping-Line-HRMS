// audit_log.
import crypto from 'crypto';
import { json } from '../utils/format.js';
import { roleFromDb } from '../../../shared/roles';
import { ROLE_LABELS } from '../../../shared/permissions';

export const audit = (conn, user, action, table, recordId, reason, oldValue = null, newValue = null) =>
  conn.query(
    'insert into audit_log (user_id, action_type, table_name, record_id, old_values, new_values, action_reason) values (?,?,?,?,?,?,?)',
    [user?.userId || null, action, table, Number.isInteger(recordId) ? recordId : null, json(oldValue), json(newValue), String(reason || '').slice(0, 255)]
  );

export const loadAuditLogs = async (conn, limit = 1000) => {
  const [rows] = await conn.query(
    `select a.*, e.employee_name, r.role_name from audit_log a
     left join users u on u.user_id = a.user_id
     left join employees e on e.employee_id = u.employee_id
     left join roles r on r.role_id = u.role_id
     order by a.audit_id desc limit ?`,
    [limit]
  );
  return rows.map((a) => ({
    id: a.audit_id,
    auditId: `#AUD-${String(a.audit_id).padStart(5, '0')}`,
    hash: crypto.createHash('sha256').update(`${a.audit_id}|${a.action_at}|${a.action_type}|${a.table_name}|${a.record_id}|${JSON.stringify(a.new_values)}`).digest('hex').slice(0, 32),
    timestamp: String(a.action_at),
    actor: a.employee_name || 'System',
    actorRole: a.role_name ? ROLE_LABELS[roleFromDb(a.role_name)] : 'SYSTEM',
    action: a.action_type,
    targetEntity: a.table_name,
    recordId: a.record_id === null ? '' : String(a.record_id),
    justification: a.action_reason || '',
    oldValue: a.old_values,
    newValue: a.new_values,
  }));
};
