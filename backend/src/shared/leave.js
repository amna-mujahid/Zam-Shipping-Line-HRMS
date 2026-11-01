// Leave rules driven by the `leave_type` table (grant_method, max_limit, applicable_after_probation).
import { findHoliday, isOffDay, isUnpaidLeaveType } from './attendance';
import { dateRange, parseDate } from './dates';

// Working days between two dates: excludes calendar off days and holidays.
export const countWorkingDays = (from, to, ctx) =>
  from && to && to >= from ? dateRange(from, to).filter((d) => !isOffDay(ctx, d) && !findHoliday(ctx.holidays, d)).length : 0;

// Entitlement for a leave type in a calendar year, as of `today`.
export const entitlementFor = (type, emp, year, today) => {
  if (type.applicableAfterProbation && emp.status === 'Probation') return 0;
  if (type.grantMethod === 'Monthly') {
    // Accrues max_limit / 12 per completed month of the year (from joining if joined this year).
    const yearStart = `${year}-01-01`;
    const start = emp.joiningDate > yearStart ? emp.joiningDate : yearStart;
    if (today < start) return 0;
    const end = today.slice(0, 4) > year ? `${year}-12-31` : today;
    const s = parseDate(start);
    const e = parseDate(end);
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
    return Math.min(type.maxLimit, Math.round((type.maxLimit / 12) * months * 2) / 2);
  }
  return type.maxLimit; // Yearly / Ad_hoc
};

export const leaveBalancesFor = (emp, leaves, leaveTypes, ctx, year, today) => {
  const mine = leaves.filter((l) => l.empId === emp.empId && l.fromDate.startsWith(year));
  const daysOf = (l) => countWorkingDays(l.fromDate, l.toDate, ctx);
  return leaveTypes.map((t) => {
    const entitled = entitlementFor(t, emp, year, today);
    const used = mine.filter((l) => l.leaveTypeId === t.id && l.status === 'Approved').reduce((a, l) => a + daysOf(l), 0);
    const pending = mine.filter((l) => l.leaveTypeId === t.id && l.status === 'Pending').reduce((a, l) => a + daysOf(l), 0);
    return {
      typeId: t.id,
      type: t.name,
      unpaid: isUnpaidLeaveType(t.name),
      grantMethod: t.grantMethod,
      entitled,
      used,
      pending,
      available: entitled - used - pending,
    };
  });
};
