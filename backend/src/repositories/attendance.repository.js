// attendance + attendance_request (corrections).
import { getCalendarId } from './reference.repository.js';
import { hm, json } from '../utils/format.js';
import { STATUS_FROM_DB, recordKey } from '../shared/attendance.js';

export const AUTO_METHOD = 'Auto';

export const mapAttendance = (a) => ({
  dbId: a.attendance_id,
  empId: String(a.employee_id),
  date: a.calendar_date,
  inTime: hm(a.in_time),
  outTime: hm(a.out_time),
  breaks: Array.isArray(a.breaks) ? a.breaks : [],
  method: a.check_in_method || (a.is_manual ? 'Manual' : null),
  location: a.location || null,
  notes: a.remarks || '',
  isManual: !!a.is_manual,
  manualStatus: a.is_manual ? STATUS_FROM_DB[a.status] || 'PRESENT' : null,
  dbStatus: a.status,
});

export const loadAttendance = async (conn, { from, to = null, employeeId = null }) => {
  const params = [from];
  let sql = `select a.*, c.calendar_date from attendance a join calendar c on c.calendar_id = a.calendar_id where c.calendar_date >= ?`;
  if (to) { sql += ' and c.calendar_date <= ?'; params.push(to); }
  if (employeeId) { sql += ' and a.employee_id = ?'; params.push(employeeId); }
  const [rows] = await conn.query(sql, params);
  const records = {};
  rows.forEach((r) => {
    const rec = mapAttendance(r);
    records[recordKey(rec.empId, rec.date)] = rec;
  });
  return records;
};

export const getRecord = async (conn, employeeId, date) => {
  const recs = await loadAttendance(conn, { from: date, to: date, employeeId });
  return recs[recordKey(String(employeeId), date)] || null;
};

export const upsertAttendance = async (conn, user, employeeId, date, rec) => {
  const calendarId = await getCalendarId(conn, date);
  await conn.query(
    `insert into attendance (employee_id, calendar_id, in_time, out_time, status, remarks, is_manual, check_in_method, location, breaks, created_by, updated_by)
     values (?,?,?,?,?,?,?,?,?,?,?,?)
     on duplicate key update in_time = values(in_time), out_time = values(out_time), status = values(status),
       remarks = values(remarks), is_manual = values(is_manual), check_in_method = values(check_in_method),
       location = values(location), breaks = values(breaks), updated_by = values(updated_by)`,
    [
      employeeId, calendarId, rec.inTime || null, rec.outTime || null, rec.status, String(rec.notes || '').slice(0, 255) || null,
      rec.isManual ? 1 : 0, rec.method || null, json(rec.location), json(rec.breaks || []), user.userId, user.userId,
    ]
  );
};

export const deleteAttendance = (conn, employeeId, date) =>
  conn.query(
    'delete a from attendance a join calendar c on c.calendar_id = a.calendar_id where a.employee_id = ? and c.calendar_date = ?',
    [employeeId, date]
  );

// rows: [employee_id, calendar_id, status, remarks, is_manual, check_in_method, breaks][]
// INSERT IGNORE never touches a row that already exists (unique employee + day).
export const insertIgnoreAttendanceRows = async (conn, rows) => {
  const [res] = await conn.query(
    'insert ignore into attendance (employee_id, calendar_id, status, remarks, is_manual, check_in_method, breaks) values ?',
    [rows]
  );
  return res.affectedRows;
};

// ---- corrections (attendance_request) ---------------------------------------

export const loadRegularizations = async (conn, { employeeId = null } = {}) => {
  const [rows] = await conn.query(
    `select ar.*, c.calendar_date, eh.employee_name as hr_name
     from attendance_request ar
     join calendar c on c.calendar_id = ar.calendar_id
     left join users uh on uh.user_id = ar.hr_id
     left join employees eh on eh.employee_id = uh.employee_id
     ${employeeId ? 'where ar.employee_id = ?' : ''}
     order by ar.attendance_request_id desc`,
    employeeId ? [employeeId] : []
  );
  return rows.map((r) => ({
    id: r.attendance_request_id,
    reqCode: `REG-${r.attendance_request_id}`,
    empId: String(r.employee_id),
    date: r.calendar_date,
    originalIn: hm(r.original_in_time),
    originalOut: hm(r.original_out_time),
    requestedIn: hm(r.updated_in_time),
    requestedOut: hm(r.updated_out_time),
    reason: r.reason,
    status: r.hr_status,
    submittedAt: r.request_date,
    decidedBy: r.hr_name || null,
    comment: r.hr_remarks || '',
  }));
};

export const hasPendingRegularization = async (conn, employeeId, calendarId) => {
  const [[dup]] = await conn.query("select 1 as x from attendance_request where employee_id = ? and calendar_id = ? and hr_status = 'Pending'", [employeeId, calendarId]);
  return !!dup;
};

export const insertRegularization = async (conn, r) => {
  const [res] = await conn.query(
    'insert into attendance_request (employee_id, calendar_id, updated_in_time, updated_out_time, reason, original_in_time, original_out_time) values (?,?,?,?,?,?,?)',
    [r.employeeId, r.calendarId, r.requestedIn, r.requestedOut, r.reason, r.originalIn, r.originalOut]
  );
  return res.insertId;
};

export const findRegularizationForUpdate = async (conn, id) => {
  const [[req]] = await conn.query(
    'select ar.*, c.calendar_date from attendance_request ar join calendar c on c.calendar_id = ar.calendar_id where ar.attendance_request_id = ? for update',
    [id]
  );
  return req || null;
};

export const setRegularizationDecision = (conn, id, { status, hrId, remarks, verifiedIn }) =>
  conn.query(
    'update attendance_request set hr_status = ?, hr_id = ?, hr_remarks = ?, hr_action_at = now(), verified_in_time = ? where attendance_request_id = ?',
    [status, hrId, remarks, verifiedIn, id]
  );
