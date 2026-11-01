// Glue between database reference data and the shared attendance engine.
import { DB_STATUS, computeDay, recordKey } from '../../../shared/attendance';

export const engineCtx = (ref, records = {}, leaves = []) => ({
  records,
  leaves,
  holidays: ref.holidays,
  shifts: ref.shifts,
  calendar: { from: ref.calendar.from, to: ref.calendar.to, offDays: new Set(ref.calendar.offDays) },
});

// Status column value for a punched day; must be one of the values the schema allows.
export const dbStatusForPunches = (emp, date, rec, ref) => {
  const day = computeDay(emp, date, engineCtx(ref, { [recordKey(emp.empId, date)]: { ...rec, isManual: false } }));
  if (day.status === 'LATE') return DB_STATUS.LATE;
  if (day.status === 'HALF_DAY') return DB_STATUS.HALF_DAY;
  return DB_STATUS.PRESENT;
};
