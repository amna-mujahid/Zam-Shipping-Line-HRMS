import React, { useMemo, useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { computePayslip } from '@shared/payroll';
import { fmtDate, fmtMoney, monthKeyOf, monthLabel, todayStr } from '@shared/dates';
import { PayslipModal } from '../common/Payslip';
import { Btn, Card, EmptyRow, Page, PageHeader, Pill, StatCard, Table } from '../common/ui';

export const MyPayslipsView = () => {
  const { currentUser, payrollRuns, attendanceCtx, payrollSettings } = useHrms();
  const [open, setOpen] = useState(null);

  // Only finalized runs are published to employees, and only their own slip.
  const published = useMemo(
    () =>
      Object.entries(payrollRuns)
        .filter(([, run]) => run.status === 'FINALIZED')
        .map(([m, run]) => ({ month: m, run, slip: run.payslips.find((p) => p.empId === currentUser.empId) }))
        .filter((x) => x.slip)
        .sort((a, b) => b.month.localeCompare(a.month)),
    [payrollRuns, currentUser.empId]
  );

  const current = monthKeyOf(todayStr());
  const estimate = useMemo(
    () => (payrollRuns[current] ? null : computePayslip(currentUser, current, attendanceCtx, payrollSettings)),
    [payrollRuns, current, currentUser, attendanceCtx, payrollSettings]
  );

  const year = current.slice(0, 4);
  const ytd = published.filter((p) => p.month.startsWith(year));
  const ytdSum = (k) => ytd.reduce((a, p) => a + p.slip[k], 0);

  return (
    <Page>
      <PageHeader kicker="MY SELF-SERVICE" icon="receipt" title="My Payslips" subtitle="Payslips appear here once payroll for the month is finalized." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={`YTD gross ${year}`} value={fmtMoney(ytdSum('grossEarnings'))} icon="account_balance_wallet" />
        <StatCard label="YTD taxes" value={fmtMoney(ytdSum('taxTotal'))} icon="account_balance" tone="amber" />
        <StatCard label="YTD net pay" value={fmtMoney(ytdSum('netPay'))} icon="payments" tone="emerald" />
        <StatCard label="Payslips" value={published.length} icon="receipt_long" tone="slate" />
      </div>

      {estimate && (
        <Card
          title={`${monthLabel(current)} — running estimate`}
          subtitle="Based on your attendance so far. Not final until payroll is processed."
          actions={<Btn variant="outline" icon="visibility" onClick={() => setOpen({ slip: estimate, status: 'DRAFT' })}>Preview</Btn>}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div><div className="text-[10px] font-mono text-slate-400 uppercase">Projected gross</div><div className="font-black font-tabular-data text-base">{fmtMoney(estimate.grossEarnings)}</div></div>
            <div><div className="text-[10px] font-mono text-slate-400 uppercase">Overtime hours</div><div className="font-black font-tabular-data text-base">{estimate.attendance.overtimeHours}</div></div>
            <div><div className="text-[10px] font-mono text-slate-400 uppercase">Loss of pay days</div><div className="font-black font-tabular-data text-base">{estimate.attendance.lopDays}</div></div>
            <div><div className="text-[10px] font-mono text-slate-400 uppercase">Estimated net</div><div className="font-black font-tabular-data text-base text-emerald-700">{fmtMoney(estimate.netPay)}</div></div>
          </div>
        </Card>
      )}

      <Card title="Published payslips" bodyClass="">
        <Table head={['Pay period', 'Status', 'Working / LOP days', { label: 'Gross', className: 'text-right' }, { label: 'Deductions', className: 'text-right' }, { label: 'Net pay', className: 'text-right' }, '']} minWidth="min-w-[720px]">
          {published.length === 0 && <EmptyRow cols={7} text="No payslips have been published yet." />}
          {published.map(({ month, run, slip }) => (
            <tr key={month} className="hover:bg-slate-50">
              <td className="py-3 px-4">
                <div className="font-bold text-slate-900">{monthLabel(month)}</div>
                <div className="text-[10px] text-slate-400 font-mono">Published {fmtDate(run.finalizedAt)}</div>
              </td>
              <td className="py-3 px-4"><Pill value="FINALIZED" /></td>
              <td className="py-3 px-4 font-mono">{slip.attendance.workingDays} / {slip.attendance.lopDays}</td>
              <td className="py-3 px-4 font-mono text-right">{fmtMoney(slip.grossEarnings)}</td>
              <td className="py-3 px-4 font-mono text-right text-rose-700">{fmtMoney(slip.totalDeductions)}</td>
              <td className="py-3 px-4 font-mono text-right font-black text-emerald-700">{fmtMoney(slip.netPay)}</td>
              <td className="py-3 px-4 text-right"><Btn variant="ghost" icon="receipt" className="px-2 py-1" onClick={() => setOpen({ slip, status: 'FINALIZED' })}>View</Btn></td>
            </tr>
          ))}
        </Table>
      </Card>

      {open && <PayslipModal slip={open.slip} status={open.status} onClose={() => setOpen(null)} />}
    </Page>
  );
};
