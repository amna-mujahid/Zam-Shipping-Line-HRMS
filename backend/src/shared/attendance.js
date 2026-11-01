// Attendance engine.
// Stored records only hold raw punches (in/out, breaks, capture method).
// Everything else — status, worked hours, lateness, overtime, absences —
// is derived here so payroll and reports always agree with the timesheet.
import { dayName, isWeekend, nowTimeStr, timeToMin, todayStr } from './dates';

export const STATUS_META = {
  PRESENT: { label: 'Present', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  LATE: { label: 'Late', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  HALF_DAY: { label: 'Half Day', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  MISSED_PUNCH: { label: 'Missed Punch', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  ABSENT: { label: 'Absent', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  ON_LEAVE: { label: 'On Leave', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  HOLIDAY: { label: 'Holiday', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  WEEKEND: { label: 'Weekend', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  OFF_DAY_WORK: { label: 'Off-Day Work', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  WORKING: { label: 'Clocked In', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NOT_IN: { label: 'Not Clocked In', cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  UPCOMING: { label: 'Upcoming', cls: 'bg-white text-slate-400 border-slate-200' },
  PRE_JOIN: { label: 'Not Joined', cls: 'bg-white text-slate-300 border-slate-100' },
};

// A leave type is unpaid when its name says so (e.g. "Unpaid Leave", "Leave Without Pay").
export const isUnpaidLeaveType = (name = '') => /unpaid|without pay|lwp/i.test(name);

// Manual attendance marks map 1:1 to the `attendance.status` values allowed by the database.
export const DB_STATUS = { PRESENT: 'Present', ABSENT: 'Absent', LATE: 'Late', HALF_DAY: 'Half Day', ON_LEAVE: 'On Leave' };
export const STATUS_FROM_DB = Object.fromEntries(Object.entries(DB_STATUS).map(([k, v]) => [v, k]));

const DEFAULT_SHIFT = { id: 'default', name: 'General', start: '09:00', end: '18:00', graceMin: 15, halfDayAfter: '13:00', breakMin: 60, standardMin: 480 };

// Off days come from the `calendar` table when it covers the date, otherwise Saturday/Sunday.
export const isOffDay = (ctx, date) => {
  if (ctx.calendar && date >= ctx.calendar.from && date <= ctx.calendar.to) return ctx.calendar.offDays.has(date);
  return isWeekend(date);
};

export const recordKey = (empId, date) => `${empId}|${date}`;

// True when the current time is past the schedule's normal out time (day shifts only).
export const isAfterShiftEnd = (shift, now = nowTimeStr()) =>
  timeToMin(shift.end) > timeToMin(shift.start) && timeToMin(now) > timeToMin(shift.end);

const spanMinutes = (start, end) => {
  let diff = timeToMin(end) - timeToMin(start);
  if (diff < 0) diff += 1440; // crosses midnight
  return diff;
};

export const breakMinutesOf = (record, isLive) =>
  (record.breaks || []).reduce((sum, b) => {
    if (b.end) return sum + spanMinutes(b.start, b.end);
    return isLive ? sum + spanMinutes(b.start, nowTimeStr()) : sum;
  }, 0);

export const findHoliday = (holidays, date) =>
  holidays.find((h) => date >= h.fromDate && date <= h.toDate) || null;

export const findApprovedLeave = (leaves, empId, date) =>
  leaves.find(
    (l) => l.empId === empId && l.status === 'Approved' && date >= l.fromDate && date <= l.toDate
  ) || null;

/**
 * Derive one employee's attendance for one calendar date.
 * ctx = { records, leaves, holidays, shifts }
 */
export const computeDay = (emp, date, ctx) => {
  const today = todayStr();
  const shift = ctx.shifts.find((s) => s.id === emp.shiftId) || ctx.shifts[0] || DEFAULT_SHIFT;
  const record = ctx.records[recordKey(emp.empId, date)] || null;
  const holiday = findHoliday(ctx.holidays, date);
  const weekend = isOffDay(ctx, date);
  const nonWorking = weekend || !!holiday;
  const leave = nonWorking ? null : findApprovedLeave(ctx.leaves, emp.empId, date);

  const day = {
    date,
    day: dayName(date),
    empId: emp.empId,
    shift,
    record,
    holiday,
    leave,
    isWorkingDay: !nonWorking,
    inTime: record?.inTime || null,
    outTime: record?.outTime || null,
    method: record?.method || null,
    location: record?.location || null,
    notes: record?.notes || '',
    breakMinutes: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
    lateMinutes: 0,
    onBreak: false,
    status: 'UPCOMING',
  };

  if (emp.joiningDate && date < emp.joiningDate) {
    day.status = 'PRE_JOIN';
    return day;
  }

  // Manual mark (Present / Absent / Late / Half Day) set by HR or a department head.
  if (record?.isManual && record.manualStatus) {
    day.status = record.manualStatus;
    if (record.inTime && record.outTime) {
      day.breakMinutes = breakMinutesOf(record, false);
      day.workedMinutes = Math.max(0, spanMinutes(record.inTime, record.outTime) - day.breakMinutes);
      const extra = day.workedMinutes - shift.standardMin;
      day.overtimeMinutes = extra > 0 ? Math.floor(extra / 15) * 15 : 0;
    } else if (day.status === 'PRESENT' || day.status === 'LATE') {
      day.workedMinutes = shift.standardMin;
    } else if (day.status === 'HALF_DAY') {
      day.workedMinutes = Math.round(shift.standardMin / 2);
    }
    if (day.status === 'LATE' && record.inTime) {
      day.lateMinutes = Math.max(0, timeToMin(record.inTime) - timeToMin(shift.start));
    }
    if (day.status === 'ON_LEAVE' && !leave) day.leave = { leaveType: 'Leave (marked)', status: 'Approved' };
    return day;
  }

  if (record?.inTime) {
    const isLive = date === today && !record.outTime;
    const end = record.outTime || (isLive ? nowTimeStr() : null);
    day.breakMinutes = breakMinutesOf(record, isLive);
    day.onBreak = isLive && (record.breaks || []).some((b) => !b.end);
    day.workedMinutes = end ? Math.max(0, spanMinutes(record.inTime, end) - day.breakMinutes) : 0;

    if (nonWorking) {
      day.status = 'OFF_DAY_WORK';
      day.overtimeMinutes = Math.floor(day.workedMinutes / 15) * 15;
      return day;
    }

    const lateBy = timeToMin(record.inTime) - timeToMin(shift.start);
    if (lateBy > shift.graceMin) day.lateMinutes = lateBy;
    const extra = day.workedMinutes - shift.standardMin;
    // Overtime is paid in completed 15-minute blocks.
    day.overtimeMinutes = record.outTime && extra > 0 ? Math.floor(extra / 15) * 15 : 0;

    if (isLive) day.status = 'WORKING';
    else if (!record.outTime) day.status = 'MISSED_PUNCH';
    // After half_day_after (e.g. 10:30) the whole day counts as a half day; so does working < half the standard hours.
    else if (timeToMin(record.inTime) > timeToMin(shift.halfDayAfter) || day.workedMinutes < shift.standardMin / 2)
      day.status = 'HALF_DAY';
    else if (day.lateMinutes > 0) day.status = 'LATE';
    else day.status = 'PRESENT';
    return day;
  }

  if (leave) day.status = 'ON_LEAVE';
  else if (holiday) day.status = 'HOLIDAY';
  else if (weekend) day.status = 'WEEKEND';
  else if (date < today) day.status = 'ABSENT';
  // Today: once the schedule's out time has passed without a check-in, the employee is absent.
  else if (date === today) day.status = isAfterShiftEnd(shift) ? 'ABSENT' : 'NOT_IN';
  else day.status = 'UPCOMING';
  return day;
};

export const computeRange = (emp, dates, ctx) => dates.map((d) => computeDay(emp, d, ctx));

// Aggregate a list of computed days into timesheet totals.
export const summarizeDays = (days) => {
  const s = {
    workingDays: 0, present: 0, late: 0, halfDay: 0, absent: 0, missedPunch: 0,
    paidLeave: 0, unpaidLeave: 0, holidays: 0, weekends: 0, offDayWork: 0, upcoming: 0, notEmployed: 0,
    workedMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, breakMinutes: 0,
  };
  days.forEach((d) => {
    if (d.isWorkingDay) s.workingDays += 1;
    s.workedMinutes += d.workedMinutes;
    s.overtimeMinutes += d.overtimeMinutes;
    s.lateMinutes += d.lateMinutes;
    s.breakMinutes += d.breakMinutes;
    switch (d.status) {
      case 'PRESENT': case 'WORKING': s.present += 1; break;
      case 'LATE': s.present += 1; s.late += 1; break;
      case 'HALF_DAY': s.halfDay += 1; break;
      case 'MISSED_PUNCH': s.missedPunch += 1; break;
      case 'ABSENT': s.absent += 1; break;
      case 'ON_LEAVE':
        if (isUnpaidLeaveType(d.leave.leaveType)) s.unpaidLeave += 1;
        else s.paidLeave += 1;
        break;
      case 'HOLIDAY': s.holidays += 1; break;
      case 'WEEKEND': s.weekends += 1; break;
      case 'OFF_DAY_WORK': s.offDayWork += 1; break;
      case 'UPCOMING': case 'NOT_IN': s.upcoming += 1; break;
      case 'PRE_JOIN': if (d.isWorkingDay) s.notEmployed += 1; break;
      default: break;
    }
  });
  const attended = s.present + s.halfDay + s.missedPunch;
  const elapsed = s.workingDays - s.upcoming - s.notEmployed;
  s.attendanceRate = elapsed > 0 ? ((attended + s.paidLeave) / elapsed) * 100 : 100;
  return s;
};

// Haversine distance in metres — used for GPS geofenced check-ins.
export const distanceMeters = (a, b) => {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
