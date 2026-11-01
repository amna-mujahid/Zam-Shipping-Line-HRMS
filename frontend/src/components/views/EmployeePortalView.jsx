import React, { useMemo } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { computeRange, summarizeDays } from '@shared/attendance';
import { fmtDate, fmtDuration, fmtMoney, monthDates, monthKeyOf, monthLabel, todayStr } from '@shared/dates';
import { Avatar, Btn, Card, Icon, Page, Pill, StatCard, StatusBadge } from '../common/ui';

export const EmployeePortalView = ({ onSelectView }) => {
  const { currentUser, attendanceCtx, dayFor, leaveBalances, leaves, regularizations, payrollRuns, holidays, policies, policyAcks } = useHrms();
  const today = todayStr();
  const month = monthKeyOf(today);
  const todayDay = dayFor(currentUser, today);
  const s = useMemo(() => summarizeDays(computeRange(currentUser, monthDates(month), attendanceCtx)), [currentUser, month, attendanceCtx]);

  const latestSlip = Object.entries(payrollRuns)
    .filter(([, r]) => r.status === 'FINALIZED')
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([m, r]) => ({ month: m, slip: r.payslips.find((p) => p.empId === currentUser.empId) }))
    .find((x) => x.slip);

  const myPending = [
    ...leaves.filter((l) => l.empId === currentUser.empId && l.status === 'Pending').map((l) => ({ id: l.id, label: `${l.leaveType} • ${fmtDate(l.fromDate)}`, view: 'leave' })),
    ...regularizations.filter((r) => r.empId === currentUser.empId && r.status === 'Pending').map((r) => ({ id: r.id, label: `Correction ${r.reqCode} • ${fmtDate(r.date)}`, view: 'regularization' })),
  ];
  const nextHolidays = holidays.filter((h) => h.toDate >= today).sort((a, b) => a.fromDate.localeCompare(b.fromDate)).slice(0, 3);
  const unacked = policies.filter((p) => !(policyAcks[currentUser.empId] || []).some((a) => a.policyId === p.id));

  return (
    <Page>
      <div className="bg-gradient-to-r from-[#0a2540] to-[#0f345c] text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Avatar emp={currentUser} size="w-16 h-16" className="rounded-2xl border-2 border-sky-400" />
          <div>
            <div className="text-[10px] font-mono font-bold text-sky-300 uppercase">Employee self-service</div>
            <h1 className="text-2xl font-black">Hello, {currentUser.name.split(' ')[0]}</h1>
            <p className="text-xs text-slate-300 font-mono">{currentUser.empId} • {currentUser.designation} • {currentUser.department}</p>
          </div>
        </div>
        <div className="bg-[#07192d]/80 rounded-xl p-4 border border-slate-700/60 flex items-center gap-4">
          <div>
            <div className="text-[10px] font-mono text-slate-400 uppercase font-bold">Today</div>
            <div className="mt-1"><StatusBadge status={todayDay.status} /></div>
            <div className="text-[11px] text-slate-300 font-mono mt-1">
              {todayDay.inTime ? `In ${todayDay.inTime}${todayDay.outTime ? ` • Out ${todayDay.outTime}` : ''} • ${fmtDuration(todayDay.workedMinutes)}` : 'Not checked in'}
            </div>
          </div>
          <Btn variant={todayDay.inTime && !todayDay.outTime ? 'danger' : 'success'} icon="fingerprint" onClick={() => onSelectView('time-clock')}>
            {todayDay.inTime && !todayDay.outTime ? 'Check out' : 'Time clock'}
          </Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={`${monthLabel(month)} present`} value={`${s.present}/${s.workingDays - s.upcoming - s.notEmployed}`} hint={`${s.attendanceRate.toFixed(0)}% attendance`} icon="how_to_reg" tone="emerald" />
        <StatCard label="Late arrivals" value={s.late} hint="3 lates = 0.5 day LOP" icon="schedule" tone="amber" />
        <StatCard label="Hours worked" value={fmtDuration(s.workedMinutes)} icon="timer" tone="sky" />
        <StatCard label="Overtime" value={fmtDuration(s.overtimeMinutes)} hint="Paid at the overtime rate" icon="more_time" tone="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Leave balance" actions={<Btn variant="ghost" className="px-2 py-1" onClick={() => onSelectView('leave')}>Apply →</Btn>}>
          <div className="space-y-3">
            {leaveBalances(currentUser.empId).filter((b) => !b.unpaid).map((b) => (
              <div key={b.typeId}>
                <div className="flex justify-between text-xs"><span className="font-semibold text-slate-700">{b.type}</span><span className="font-mono font-bold">{b.available} / {b.entitled}</span></div>
                <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden"><div className="h-full bg-sky-600" style={{ width: `${b.entitled ? Math.max(0, (b.available / b.entitled) * 100) : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Latest payslip" actions={<Btn variant="ghost" className="px-2 py-1" onClick={() => onSelectView('my-payslips')}>All payslips →</Btn>}>
          {latestSlip ? (
            <div>
              <div className="text-xs text-slate-500">{monthLabel(latestSlip.month)}</div>
              <div className="text-3xl font-black text-emerald-700 font-tabular-data mt-1">{fmtMoney(latestSlip.slip.netPay)}</div>
              <div className="text-[11px] text-slate-500 mt-1">Gross {fmtMoney(latestSlip.slip.grossEarnings)} • Deductions {fmtMoney(latestSlip.slip.totalDeductions)}</div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">No payslips published yet.</div>
          )}
        </Card>

        <Card title="My pending requests">
          {myPending.length === 0 ? (
            <div className="text-xs text-slate-400">Nothing pending.</div>
          ) : (
            <ul className="space-y-2">
              {myPending.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onSelectView(p.view)} className="w-full flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 hover:bg-slate-100">
                    <span className="font-semibold text-slate-700">{p.label}</span>
                    <Pill value="Pending" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Upcoming holidays" actions={<Btn variant="ghost" className="px-2 py-1" onClick={() => onSelectView('holidays')}>Calendar →</Btn>}>
          <ul className="space-y-2 text-xs">
            {nextHolidays.length === 0 && <li className="text-slate-400">No upcoming holidays.</li>}
            {nextHolidays.map((h) => (
              <li key={h.id} className="flex justify-between"><span className="font-semibold">{h.name}</span><span className="font-mono text-slate-500">{fmtDate(h.fromDate)}</span></li>
            ))}
          </ul>
        </Card>

        <Card title="Policies to acknowledge" className="lg:col-span-2" actions={<Btn variant="ghost" className="px-2 py-1" onClick={() => onSelectView('policies')}>Policy library →</Btn>}>
          {unacked.length === 0 ? (
            <div className="text-xs text-emerald-700 flex items-center gap-1.5"><Icon name="task_alt" /> All policies acknowledged.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unacked.map((p) => (
                <button key={p.id} type="button" onClick={() => onSelectView('policies')} className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100">
                  {p.title}
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
};
