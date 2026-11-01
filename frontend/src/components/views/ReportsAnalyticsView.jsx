import React, { useMemo, useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { STATUS_META, computeRange, summarizeDays } from '@shared/attendance';
import { addDays, fmtDate, fmtMoney, monthDates, monthKeyOf, monthLabel, parseDate, periodRangeLabel, shiftMonth, todayStr } from '@shared/dates';
import { downloadCSV } from '../../lib/csv';
import { HBarChart, SERIES_COLORS, StackedColumns } from '../common/Charts';
import { Btn, Card, Icon, Page, PageHeader, StatCard, inputCls } from '../common/ui';

const STATUS_CODE = { PRESENT: 'P', LATE: 'L', HALF_DAY: 'HD', MISSED_PUNCH: 'MP', ABSENT: 'A', ON_LEAVE: 'LV', HOLIDAY: 'H', WEEKEND: 'W', OFF_DAY_WORK: 'OT', WORKING: 'P', NOT_IN: '-', UPCOMING: '', PRE_JOIN: '' };

// Shared analytics over the selected month: one row per active employee.
export const useWorkforceAnalytics = (month) => {
  const { employees, attendanceCtx, payrollRuns, computeDraftRun } = useHrms();
  return useMemo(() => {
    const active = employees.filter((e) => e.active !== false && !e.minimal);
    const dates = monthDates(month);
    const perEmp = active.map((emp) => {
      const days = computeRange(emp, dates, attendanceCtx);
      return { emp, days, sum: summarizeDays(days) };
    });
    const slips = payrollRuns[month]?.payslips || computeDraftRun(month);
    return { active, dates, perEmp, slips, finalized: !!payrollRuns[month] };
  }, [employees, attendanceCtx, payrollRuns, computeDraftRun, month]);
};

export const ReportsAnalyticsView = ({ onShowToast }) => {
  const { employees, leaveBalances, auditLogs, employeeByEmpId } = useHrms();
  const today = todayStr();
  const current = monthKeyOf(today);
  const [month, setMonth] = useState(current);
  const { active, dates, perEmp, slips, finalized } = useWorkforceAnalytics(month);

  const totals = perEmp.reduce(
    (a, { sum }) => ({
      worked: a.worked + sum.workedMinutes, ot: a.ot + sum.overtimeMinutes, absent: a.absent + sum.absent,
      late: a.late + sum.late, elapsed: a.elapsed + (sum.workingDays - sum.upcoming - sum.notEmployed), attended: a.attended + sum.present + sum.halfDay + sum.missedPunch,
      leave: a.leave + sum.paidLeave + sum.unpaidLeave,
    }),
    { worked: 0, ot: 0, absent: 0, late: 0, elapsed: 0, attended: 0, leave: 0 }
  );
  const attendanceRate = totals.elapsed ? ((totals.attended + totals.leave) / totals.elapsed) * 100 : 0;
  const absenteeism = totals.elapsed ? (totals.absent / totals.elapsed) * 100 : 0;
  const payrollCost = slips.reduce((a, p) => a + p.employerCost, 0);

  const trendRows = dates
    .filter((d) => d <= today)
    .map((d, i) => {
      const values = { present: 0, late: 0, leave: 0, absent: 0 };
      perEmp.forEach(({ days }) => {
        const st = days[dates.indexOf(d)].status;
        if (st === 'PRESENT' || st === 'WORKING' || st === 'OFF_DAY_WORK' || st === 'HALF_DAY' || st === 'MISSED_PUNCH') values.present += 1;
        else if (st === 'LATE') values.late += 1;
        else if (st === 'ON_LEAVE') values.leave += 1;
        else if (st === 'ABSENT') values.absent += 1;
      });
      return { label: fmtDate(d), short: String(i + 1), values };
    });

  const byDept = (fn) => {
    const m = {};
    active.forEach((e) => { m[e.department] = (m[e.department] || 0) + fn(e); });
    return Object.entries(m).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const headcount = byDept(() => 1);
  const costByDept = byDept((e) => slips.find((p) => p.empId === e.empId)?.employerCost || 0);
  const otByEmp = perEmp.map(({ emp, sum }) => ({ label: emp.name, value: Math.round((sum.overtimeMinutes / 60) * 10) / 10 })).sort((a, b) => b.value - a.value);

  // ---- compliance alerts ----
  const alerts = [];
  perEmp.forEach(({ emp, sum, days }) => {
    if (sum.missedPunch) alerts.push({ tone: 'rose', text: `${emp.name}: ${sum.missedPunch} missed punch(es) awaiting regularization` });
    if (sum.overtimeMinutes > 20 * 60) alerts.push({ tone: 'amber', text: `${emp.name}: ${(sum.overtimeMinutes / 60).toFixed(1)} h overtime exceeds 20 h monthly threshold` });
    const outside = days.filter((d) => d.method === 'GPS' && d.location?.inFence === false).length;
    if (outside) alerts.push({ tone: 'amber', text: `${emp.name}: ${outside} GPS check-in(s) outside office geofence` });
  });
  active.filter((e) => e.status === 'Probation').forEach((e) => {
    const end = parseDate(e.joiningDate);
    end.setMonth(end.getMonth() + 6);
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    if (endStr <= addDays(today, 30)) alerts.push({ tone: 'sky', text: `${e.name}: probation ${endStr < today ? 'ended' : 'ends'} ${fmtDate(endStr)} — confirmation review due` });
  });

  // ---- report exports ----
  const tag = month;
  const reports = [
    {
      id: 'muster', icon: 'fact_check', category: 'STATUTORY', title: 'Attendance Register (Muster Roll)', desc: 'Employee × day status codes for the month, with totals — labour inspection format.',
      run: () => downloadCSV(`Attendance_Register_${tag}.csv`,
        ['Emp ID', 'Name', ...dates.map((d) => d.slice(8)), 'Present', 'Absent', 'Leave', 'Holidays', 'Worked h', 'OT h'],
        perEmp.map(({ emp, days, sum }) => [emp.empId, emp.name, ...days.map((d) => STATUS_CODE[d.status]), sum.present, sum.absent, sum.paidLeave + sum.unpaidLeave, sum.holidays, (sum.workedMinutes / 60).toFixed(1), (sum.overtimeMinutes / 60).toFixed(1)])),
    },
    {
      id: 'overtime', icon: 'more_time', category: 'ATTENDANCE', title: 'Overtime & Off-Day Work Report', desc: 'Every day with overtime, hours and rate category for payroll audit.',
      run: () => downloadCSV(`Overtime_${tag}.csv`, ['Emp ID', 'Name', 'Date', 'Day type', 'In', 'Out', 'Worked h', 'Overtime h'],
        perEmp.flatMap(({ emp, days }) => days.filter((d) => d.overtimeMinutes > 0).map((d) => [emp.empId, emp.name, d.date, d.status === 'OFF_DAY_WORK' ? 'Weekend/Holiday (2.0x)' : 'Weekday (1.5x)', d.inTime, d.outTime, (d.workedMinutes / 60).toFixed(2), (d.overtimeMinutes / 60).toFixed(2)]))),
    },
    {
      id: 'punctuality', icon: 'timer', category: 'ATTENDANCE', title: 'Punctuality & Late Arrival Analysis', desc: 'Late arrivals, minutes late, half days and absences per employee.',
      run: () => downloadCSV(`Punctuality_${tag}.csv`, ['Emp ID', 'Name', 'Department', 'Late count', 'Total minutes late', 'Half days', 'Absences', 'Attendance %'],
        perEmp.map(({ emp, sum }) => [emp.empId, emp.name, emp.department, sum.late, sum.lateMinutes, sum.halfDay, sum.absent, sum.attendanceRate.toFixed(1)])),
    },
    {
      id: 'payroll', icon: 'payments', category: 'PAYROLL', title: `Payroll Register (${finalized ? 'final' : 'draft'})`, desc: 'Gross, statutory deductions, benefits and net pay per employee.',
      run: () => downloadCSV(`Payroll_Register_${tag}.csv`, ['Emp ID', 'Name', 'Gross', ...slips[0].deductions.map((d) => d.label), 'Net', 'Employer cost'],
        slips.map((p) => [p.empId, p.name, p.grossEarnings, ...p.deductions.map((d) => d.amount), p.netPay, p.employerCost])),
    },
    {
      id: 'tax', icon: 'account_balance', category: 'STATUTORY', title: 'Income Tax & EOBI Summary', desc: 'Income tax withheld (FBR) and EOBI employee / employer contributions — for monthly filings.',
      run: () => downloadCSV(`Tax_EOBI_${tag}.csv`, ['Emp ID', 'Name', 'CNIC', 'Taxable gross (Rs)', 'Income tax (Rs)', 'EOBI employee (Rs)', 'EOBI employer (Rs)'],
        slips.map((p) => [p.empId, p.name, p.cnic || '', p.grossEarnings, p.deductions[0].amount, p.deductions[1].amount, p.employerContributions[0].amount])),
    },
    {
      id: 'leave', icon: 'event_available', category: 'LEAVE', title: 'Leave Balance & Liability', desc: 'Entitled, used, pending and available leave with encashment liability at daily rate (monthly gross ÷ 22).',
      run: () => downloadCSV(`Leave_Liability_${today.slice(0, 4)}.csv`, ['Emp ID', 'Name', 'Leave type', 'Entitled', 'Used', 'Pending', 'Available', 'Daily rate', 'Liability'],
        active.flatMap((e) => leaveBalances(e.empId).filter((b) => !b.unpaid).map((b) => { const rate = e.grossSalary / 22; return [e.empId, e.name, b.type, b.entitled, b.used, b.pending, b.available, rate.toFixed(2), (rate * Math.max(0, b.available)).toFixed(2)]; }))),
    },
    {
      id: 'headcount', icon: 'groups', category: 'WORKFORCE', title: 'Headcount & Demographics', desc: 'Department, status, tenure, gender and reporting line for EEO / workforce planning.',
      run: () => downloadCSV(`Headcount_${today}.csv`, ['Emp ID', 'Name', 'CNIC', 'Department', 'Designation', 'Status', 'Type', 'Gender', 'Joining date', 'Confirmation date', 'Tenure (years)', 'Manager'],
        employees.map((e) => [e.empId, e.name, e.cnic, e.department, e.designation, e.status, e.employeeType, e.gender, e.joiningDate, e.confirmationDate, ((parseDate(today) - parseDate(e.joiningDate)) / (365.25 * 864e5)).toFixed(1), employeeByEmpId(e.managerId)?.name || ''])),
    },
    {
      id: 'geofence', icon: 'location_off', category: 'SECURITY', title: 'Check-in Method & Geofence Exceptions', desc: 'All punches with capture method; GPS check-ins outside office radius flagged.',
      run: () => downloadCSV(`Checkin_Methods_${tag}.csv`, ['Emp ID', 'Name', 'Date', 'In', 'Method', 'Location', 'Inside geofence'],
        perEmp.flatMap(({ emp, days }) => days.filter((d) => d.inTime).map((d) => [emp.empId, emp.name, d.date, d.inTime, d.method, d.location?.label || '', d.method === 'GPS' ? (d.location?.inFence ? 'Yes' : 'NO') : 'n/a']))),
    },
    {
      id: 'audit', icon: 'shield', category: 'GOVERNANCE', title: 'Audit Trail Export', desc: 'Every create / update / approval with actor, role and before/after values.',
      run: () => downloadCSV(`Audit_Trail_${today}.csv`, ['Audit ID', 'Timestamp', 'Actor', 'Role', 'Action', 'Entity', 'Record', 'Details', 'Old', 'New'],
        auditLogs.map((l) => [l.auditId, l.timestamp, l.actor, l.actorRole, l.action, l.targetEntity, l.recordId, l.justification, JSON.stringify(l.oldValue), JSON.stringify(l.newValue)])),
    },
  ];

  const toneCls = { rose: 'bg-rose-50 border-rose-200 text-rose-800', amber: 'bg-amber-50 border-amber-200 text-amber-800', sky: 'bg-sky-50 border-sky-200 text-sky-800' };

  return (
    <Page>
      <PageHeader
        kicker="GOVERNANCE"
        icon="analytics"
        title="Reports & HR Analytics"
        subtitle={`${monthLabel(month)} (${periodRangeLabel(month)}) • computed live from attendance, leave and payroll`}
        actions={
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} w-auto`}>
            {[0, -1, -2, -3, -4, -5].map((n) => shiftMonth(current, n)).map((m) => <option key={m} value={m}>{monthLabel(m)} ({periodRangeLabel(m)})</option>)}
          </select>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Headcount" value={active.length} hint={`${active.filter((e) => e.status === 'Probation').length} on probation`} icon="groups" />
        <StatCard label="Attendance rate" value={`${attendanceRate.toFixed(1)}%`} icon="how_to_reg" tone="emerald" />
        <StatCard label="Absenteeism" value={`${absenteeism.toFixed(1)}%`} hint={`${totals.absent} absent days`} icon="person_off" tone="rose" />
        <StatCard label="Late arrivals" value={totals.late} icon="schedule" tone="amber" />
        <StatCard label="Overtime" value={`${(totals.ot / 60).toFixed(1)} h`} icon="more_time" tone="purple" />
        <StatCard label="Payroll cost" value={fmtMoney(payrollCost)} hint={finalized ? 'Finalized' : 'Draft estimate'} icon="payments" tone="sky" />
      </div>

      <Card title="Daily attendance" subtitle="Employees per day by attendance outcome">
        {trendRows.length ? (
          <StackedColumns
            series={[{ key: 'present', label: 'Present' }, { key: 'late', label: 'Late' }, { key: 'leave', label: 'On leave' }, { key: 'absent', label: 'Absent' }]}
            rows={trendRows}
          />
        ) : <div className="text-xs text-slate-400">No elapsed days in this month yet.</div>}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Headcount by department"><HBarChart data={headcount} valueLabel="Employees" /></Card>
        <Card title="Payroll cost by department" subtitle="Employer cost incl. EOBI / PF"><HBarChart data={costByDept} format={(v) => `Rs ${Math.round(v).toLocaleString('en-PK')}`} valueLabel="Employer cost" color={SERIES_COLORS[0]} /></Card>
        <Card title="Overtime hours by employee"><HBarChart data={otByEmp} format={(v) => `${v} h`} valueLabel="Overtime" color={SERIES_COLORS[0]} /></Card>
      </div>

      <Card title="Compliance alerts" subtitle={`${alerts.length} item(s) need attention`}>
        {alerts.length === 0 ? (
          <div className="text-xs text-emerald-700 flex items-center gap-1.5"><Icon name="verified" /> No compliance exceptions this month.</div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.map((a, i) => (
              <li key={i} className={`text-xs p-2.5 rounded-lg border flex items-start gap-2 ${toneCls[a.tone]}`}>
                <Icon name={a.tone === 'rose' ? 'error' : a.tone === 'amber' ? 'warning' : 'info'} className="text-[16px] shrink-0" />
                {a.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Report library" subtitle="Instant CSV exports for the selected month (opens in Excel / Sheets)">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map((r) => (
            <div key={r.id} className="p-4 rounded-xl border border-slate-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center"><Icon name={r.icon} className="text-[18px]" /></span>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.category}</span>
              </div>
              <div className="text-xs font-bold text-slate-900">{r.title}</div>
              <p className="text-[11px] text-slate-500 flex-1">{r.desc}</p>
              <Btn variant="outline" icon="download" onClick={() => { r.run(); onShowToast('Report generated', `${r.title} downloaded.`); }}>Download CSV</Btn>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-[10px] text-slate-400 font-mono">Status codes: {Object.entries(STATUS_CODE).filter(([k, c]) => c && c !== '-' && k !== 'WORKING' && k !== 'PRE_JOIN').map(([k, c]) => `${c}=${STATUS_META[k].label}`).join(' • ')}</p>
    </Page>
  );
};
