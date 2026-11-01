import React, { useMemo } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { addDays, fmtDate, fmtMoney, monthKeyOf, monthLabel, todayStr } from '@shared/dates';
import { StackedColumns } from '../common/Charts';
import { Avatar, Btn, Card, Icon, Page, PageHeader, Pill, StatCard, StatusBadge } from '../common/ui';

export const OwnerDashboardView = ({ onSelectView }) => {
  const { currentUser, employees, dayFor, leaves, regularizations, payrollRuns, computeDraftRun, auditLogs, employeeByEmpId } = useHrms();
  const today = todayStr();
  const month = monthKeyOf(today);
  const active = useMemo(() => employees.filter((e) => e.active !== false), [employees]);

  const todayRows = useMemo(() => active.map((e) => ({ emp: e, day: dayFor(e, today) })), [active, dayFor, today]);
  const cnt = (...st) => todayRows.filter((r) => st.includes(r.day.status)).length;

  const trend = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((d) => {
        const values = { present: 0, late: 0, leave: 0, absent: 0 };
        active.forEach((e) => {
          const st = dayFor(e, d).status;
          if (['PRESENT', 'WORKING', 'OFF_DAY_WORK', 'HALF_DAY', 'MISSED_PUNCH'].includes(st)) values.present += 1;
          else if (st === 'LATE') values.late += 1;
          else if (st === 'ON_LEAVE') values.leave += 1;
          else if (st === 'ABSENT') values.absent += 1;
        });
        return { label: fmtDate(d), short: d.slice(8), values };
      }),
    [active, dayFor, today]
  );

  const run = payrollRuns[month];
  const slips = useMemo(() => run?.payslips || computeDraftRun(month), [run, computeDraftRun, month]);
  const net = slips.reduce((a, p) => a + p.netPay, 0);
  const cost = slips.reduce((a, p) => a + p.employerCost, 0);

  const pendingLeaves = leaves.filter((l) => l.status === 'Pending');
  const pendingRegs = regularizations.filter((r) => r.status === 'Pending');

  return (
    <Page>
      <PageHeader
        kicker="OVERVIEW"
        icon="dashboard"
        title={`Good day, ${currentUser.name.split(' ')[0]}`}
        subtitle={`${fmtDate(today)} • ${active.length} active employees`}
        actions={<Btn variant="outline" icon="analytics" onClick={() => onSelectView('reports')}>Full analytics</Btn>}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Present today" value={cnt('PRESENT', 'WORKING', 'OFF_DAY_WORK')} icon="check_circle" tone="emerald" />
        <StatCard label="Late" value={cnt('LATE')} icon="schedule" tone="amber" />
        <StatCard label="On leave" value={cnt('ON_LEAVE')} icon="beach_access" tone="purple" />
        <StatCard label="Absent / not in" value={cnt('ABSENT', 'NOT_IN')} icon="person_off" tone="rose" />
        <StatCard label="Pending approvals" value={pendingLeaves.length + pendingRegs.length} icon="pending_actions" tone="sky" />
        <StatCard label={`${monthLabel(month)} payroll`} value={fmtMoney(net)} hint={run ? 'Finalized net payout' : 'Draft net payout'} icon="payments" tone="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Attendance — last 14 days" className="lg:col-span-2">
          <StackedColumns series={[{ key: 'present', label: 'Present' }, { key: 'late', label: 'Late' }, { key: 'leave', label: 'On leave' }, { key: 'absent', label: 'Absent' }]} rows={trend} />
        </Card>

        <Card title="Needs your approval">
          <ul className="space-y-2 text-xs">
            {pendingLeaves.length + pendingRegs.length === 0 && <li className="text-slate-400">Nothing pending.</li>}
            {pendingLeaves.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => onSelectView('leave')} className="w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2">
                  <span><strong>{employeeByEmpId(l.empId)?.name}</strong> — {l.leaveType}<br /><span className="text-slate-500 font-mono text-[10px]">{fmtDate(l.fromDate)} → {fmtDate(l.toDate)}</span></span>
                  <Pill value="Pending" />
                </button>
              </li>
            ))}
            {pendingRegs.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onSelectView('regularization')} className="w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2">
                  <span><strong>{employeeByEmpId(r.empId)?.name}</strong> — attendance correction<br /><span className="text-slate-500 font-mono text-[10px]">{fmtDate(r.date)}</span></span>
                  <Pill value="Pending" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Who's in today" className="lg:col-span-2" bodyClass="p-2" actions={<Btn variant="ghost" className="px-2 py-1" onClick={() => onSelectView('attendance')}>Daily log →</Btn>}>
          <ul className="divide-y divide-slate-100">
            {todayRows.map(({ emp, day }) => (
              <li key={emp.empId} className="flex items-center gap-3 p-2.5">
                <Avatar emp={emp} size="w-8 h-8" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">{emp.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{emp.department}</div>
                </div>
                <span className="text-[11px] font-mono text-slate-500">{day.inTime ? `${day.inTime}${day.outTime ? `–${day.outTime}` : ''}` : ''}</span>
                <StatusBadge status={day.status} />
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card title="Payroll" actions={<Btn variant="ghost" className="px-2 py-1" onClick={() => onSelectView('payroll')}>Open →</Btn>}>
            <div className="text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">{monthLabel(month)}</span><Pill value={run ? 'FINALIZED' : 'DRAFT'} /></div>
              <div className="flex justify-between"><span className="text-slate-500">Net payout</span><span className="font-bold font-tabular-data">{fmtMoney(net)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Employer cost</span><span className="font-bold font-tabular-data">{fmtMoney(cost)}</span></div>
            </div>
          </Card>
          <Card title="Recent activity" actions={<Btn variant="ghost" className="px-2 py-1" onClick={() => onSelectView('audit-log')}>Audit trail →</Btn>}>
            <ul className="space-y-2 text-[11px]">
              {auditLogs.slice(0, 6).map((l) => (
                <li key={l.id} className="flex gap-2">
                  <Icon name="history" className="text-[14px] text-slate-400 mt-0.5" />
                  <span><strong>{l.actor}</strong> {l.action.toLowerCase().replace('_', ' ')} {l.targetEntity} <span className="text-slate-400">{l.recordId}</span></span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Page>
  );
};
