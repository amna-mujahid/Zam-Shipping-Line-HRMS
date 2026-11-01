// Lookup data: departments, designations, schedules, leave types, holidays, calendar, roles.
import { pool } from '../config/database.js';
import { hm } from '../utils/format.js';
import { roleFromDb } from '../../../shared/roles';
import { isWeekend, timeToMin } from '../../../shared/dates';

export const shiftFromSchedule = (s) => {
  const start = hm(s.reporting_time);
  const end = hm(s.normal_out_time);
  let span = timeToMin(end) - timeToMin(start);
  if (span <= 0) span += 1440;
  return {
    id: String(s.schedule_id),
    dbId: s.schedule_id,
    name: s.schedule_name,
    start,
    end,
    lateAfter: hm(s.late_after),
    graceMin: Math.max(0, timeToMin(hm(s.late_after)) - timeToMin(start)),
    halfDayAfter: hm(s.half_day_after),
    breakMin: 60,
    standardMin: Math.max(240, span - 60),
    remarks: s.remarks || '',
  };
};

export const loadReference = async (conn = pool) => {
  const [departments] = await conn.query('select department_id, department_name from departments order by department_name');
  const [schedules] = await conn.query('select * from schedule order by schedule_id');
  const [designations] = await conn.query('select designation_id, designation_name, schedule_id from designations order by designation_name');
  const [leaveTypes] = await conn.query('select * from leave_type order by leave_type_id');
  const [holidays] = await conn.query('select * from holiday order by holiday_from_date');
  const [[range]] = await conn.query('select min(calendar_date) as f, max(calendar_date) as t from calendar');
  const [offRows] = await conn.query("select calendar_date from calendar where day_status = 'Off Day'");
  const [roles] = await conn.query('select role_id, role_name from roles order by role_id');
  return {
    departments: departments.map((d) => ({ id: d.department_id, name: d.department_name })),
    designations: designations.map((d) => ({ id: d.designation_id, name: d.designation_name, scheduleId: d.schedule_id ? String(d.schedule_id) : null })),
    shifts: schedules.map(shiftFromSchedule),
    leaveTypes: leaveTypes.map((t) => ({
      id: t.leave_type_id, name: t.leave_type, grantMethod: t.grant_method, maxLimit: t.max_limit,
      approvalRequired: !!t.approval_required, applicableAfterProbation: !!t.applicable_after_probation,
    })),
    holidays: holidays.map((h) => ({ id: h.holiday_id, name: h.holiday_name, fromDate: h.holiday_from_date, toDate: h.holiday_to_date, division: 'All' })),
    calendar: { from: range?.f || null, to: range?.t || null, offDays: offRows.map((r) => r.calendar_date) },
    roles: roles.map((r) => ({ id: r.role_id, name: r.role_name, appRole: roleFromDb(r.role_name) })),
  };
};

export const lookupName = async (conn, table, idCol, nameCol, id) => {
  const [[row]] = await conn.query(`select ${nameCol} as n from ${table} where ${idCol} = ?`, [id]);
  return row?.n || '';
};

// ---- calendar ---------------------------------------------------------------

export const getCalendarId = async (conn, date) => {
  const [[row]] = await conn.query('select calendar_id from calendar where calendar_date = ?', [date]);
  if (row) return row.calendar_id;
  const [res] = await conn.query('insert into calendar (calendar_date, day_status) values (?, ?)', [date, isWeekend(date) ? 'Off Day' : 'Working']);
  return res.insertId;
};

export const calendarIdsBetween = async (conn, from, to) => {
  const [rows] = await conn.query('select calendar_id, calendar_date from calendar where calendar_date between ? and ?', [from, to]);
  return Object.fromEntries(rows.map((c) => [c.calendar_date, c.calendar_id]));
};

// ---- org setup --------------------------------------------------------------

export const insertDepartment = async (conn, name) => {
  const [res] = await conn.query('insert into departments (department_name) values (?)', [name]);
  return res.insertId;
};

export const insertDesignation = async (conn, name, scheduleId) => {
  const [res] = await conn.query('insert into designations (designation_name, schedule_id) values (?,?)', [name, scheduleId]);
  return res.insertId;
};

export const updateDesignationSchedule = (conn, designationId, scheduleId) =>
  conn.query('update designations set schedule_id = ? where designation_id = ?', [scheduleId, designationId]);

export const insertSchedule = async (conn, cols) => {
  const [res] = await conn.query('insert into schedule set ?', [cols]);
  return res.insertId;
};

export const updateSchedule = (conn, id, cols) => conn.query('update schedule set ? where schedule_id = ?', [cols, id]);

// ---- holidays ---------------------------------------------------------------

export const insertHoliday = async (conn, name, fromDate, toDate) => {
  const [res] = await conn.query('insert into holiday (holiday_name, holiday_from_date, holiday_to_date) values (?,?,?)', [name, fromDate, toDate]);
  await conn.query("update calendar set day_status = 'Holiday', holiday_id = ? where calendar_date between ? and ?", [res.insertId, fromDate, toDate]);
  return res.insertId;
};

export const findHolidayById = async (conn, id) => {
  const [[h]] = await conn.query('select * from holiday where holiday_id = ?', [id]);
  return h || null;
};

export const deleteHoliday = async (conn, id) => {
  await conn.query("update calendar set holiday_id = null, day_status = if(dayofweek(calendar_date) in (1, 7), 'Off Day', 'Working') where holiday_id = ?", [id]);
  await conn.query('delete from holiday where holiday_id = ?', [id]);
};
