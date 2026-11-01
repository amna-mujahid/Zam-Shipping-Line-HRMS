import React, { useMemo, useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { fmtDate, fmtMoney, monthKeyOf, monthLabel, periodRangeLabel, shiftMonth, todayStr } from '@shared/dates';
import { downloadCSV } from '../../lib/csv';
import { PayslipModal } from '../common/Payslip';
import { Avatar, Btn, Card, Field, Page, PageHeader, Pill, StatCard, Table, Tabs, inputCls } from '../common/ui';

const SETTING_FIELDS = [
  ['basicPct', 'Basic salary (% of gross)'],
  ['houseRentPct', 'House rent allowance (%)'],
  ['utilityPct', 'Utility allowance (%)'],
  ['standardMonthlyHours', 'Standard hours / month (overtime rate basis)'],
  ['overtimeMultiplier', 'Weekday overtime multiplier'],
  ['offDayMultiplier', 'Off-day / holiday multiplier'],
  ['latesPerHalfDay', 'Late arrivals per 0.5 day deduction'],
  ['eobiEmployee', 'EOBI employee (Rs / month)'],
  ['eobiEmployer', 'EOBI employer (Rs / month)'],
  ['providentFundPct', 'Provident fund employee (% of basic)'],
  ['employerPfPct', 'Provident fund employer (% of basic)'],
]

export const PayrollView = ({ onShowToast }) => {
  const { payrollRuns, payrollSettings, computeDraftRun, finalizePayroll, reopenPayroll, updatePayrollSettings, employeeByEmpId } = useHrms();
  const current = monthKeyOf(todayStr());
  const months = useMemo(() => {
    const keys = new Set([...Object.keys(payrollRuns), current, shiftMonth(current, -1), shiftMonth(current, -2)]);
    return [...keys].sort().reverse();
  }, [payrollRuns, current]);

  const [month, setMonth] = useState(current);
  const [tab, setTab] = useState('register');
  const [slip, setSlip] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(payrollSettings || {});

  const run = payrollRuns[month];
  const status = run?.status || 'DRAFT';
  const slips = useMemo(() => (run ? run.payslips : computeDraftRun(month)), [run, computeDraftRun, month]);

  const sum = (k) => slips.reduce((a, p) => a + p[k], 0);
  const otPay = slips.reduce((a, p) => a + p.earnings.find((e) => e.label.startsWith('Overtime')).amount, 0);
  const lopPay = -slips.reduce((a, p) => a + p.earnings.find((e) => e.label.startsWith('Loss of Pay')).amount, 0);
  const benefit = (p) => p.deductions.filter((d) => d.group !== 'Tax').reduce((a, d) => a + d.amount, 0);

  const exportRegister = () => {
    downloadCSV(
      `Payroll_Register_${month}.csv`,
      ['Emp ID', 'Name', 'CNIC', 'Department', 'Working Days', 'Present', 'Absent', 'Unpaid Leave', 'LOP Days', 'OT Hours', 'Gross Earnings', ...(slips[0]?.deductions || []).map((d) => d.label), 'Total Deductions', 'Net Pay', 'Employer Cost'],
      slips.map((p) => [
        p.empId, p.name, p.cnic, p.department, p.attendance.workingDays, p.attendance.present, p.attendance.absent, p.attendance.unpaidLeave,
        p.attendance.lopDays, p.attendance.overtimeHours, p.grossEarnings, ...p.deductions.map((d) => d.amount), p.totalDeductions, p.netPay, p.employerCost,
      ])
    );
    onShowToast('Register exported', `Payroll register for ${monthLabel(month)} downloaded.`);
  };

  const exportBankFile = () => {
    downloadCSV(
      `Bank_Transfer_${month}.csv`,
      ['Emp ID', 'Beneficiary', 'CNIC', 'Bank', 'Account / IBAN', 'Branch Code', 'Amount (Rs)', 'Reference'],
      slips.map((p) => {
        const e = employeeByEmpId(p.empId);
        return [p.empId, p.name, p.cnic || e?.cnic || '', e?.bank?.bankName || '', e?.bank?.accountNumber || '', e?.bank?.branchCode || '', p.netPay.toFixed(2), `SALARY ${month}`];
      })
    );
    onShowToast('Bank file exported', `${slips.length} salary transfers for ${monthLabel(month)}.`);
  };

  const doFinalize = async () => {
    if (!window.confirm(`Finalize payroll for ${monthLabel(month)}? Payslips will be published to employees and figures locked.`)) return;
    const res = await finalizePayroll(month);
    if (res.ok) onShowToast('Payroll finalized', `${res.count} payslips published for ${monthLabel(month)}.`);
    else onShowToast('Not finalized', res.error, 'error');
  };

  const doReopen = async () => {
    if (!window.confirm(`Re-open ${monthLabel(month)}? Published payslips will be withdrawn until you finalize again.`)) return;
    const res = await reopenPayroll(month);
    if (res.ok) onShowToast('Payroll re-opened', 'Figures now recalculate live from attendance.', 'warning');
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    const patch = Object.fromEntries(SETTING_FIELDS.map(([k]) => [k, Number(settingsDraft[k])]));
    if (patch.basicPct + patch.houseRentPct + patch.utilityPct !== 100) {
      onShowToast('Check salary split', 'Basic + house rent + utility must total 100%.', 'error');
      return;
    }
    const res = await updatePayrollSettings(patch);
    if (res.ok) onShowToast('Payroll rules saved', 'Draft payroll runs now use the new rules. Finalized runs are unchanged.');
    else onShowToast('Not saved', res.error, 'error');
  };

  return (
    <Page>
      <PageHeader
        kicker="PAYROLL"
        icon="payments"
        title="Payroll Processing"
        subtitle="Monthly PKR payroll: salary, overtime, loss of pay, FBR income tax and EOBI — calculated from attendance and approved leave."
        actions={
          <>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} w-auto`}>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)} ({periodRangeLabel(m)}) {payrollRuns[m] ? '• Finalized' : '• Draft'}</option>)}
            </select>
            {status === 'DRAFT'
              ? <Btn variant="success" icon="lock" onClick={doFinalize} disabled={month > current}>Finalize & publish</Btn>
              : <Btn variant="outline" icon="lock_open" onClick={doReopen}>Re-open</Btn>}
          </>
        }
      />

      <div className="flex items-center gap-3 flex-wrap text-xs">
        <Pill value={status} />
        {run ? (
          <span className="text-slate-500">Finalized {fmtDate(run.finalizedAt)} by {run.finalizedBy}. Figures are locked snapshots.</span>
        ) : (
          <span className="text-slate-500">
            Live draft — recalculates as attendance, corrections and leave change.
            {month === current && ' Remaining days of the month are treated as worked until they elapse.'}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Employees" value={slips.length} icon="groups" />
        <StatCard label="Gross earnings" value={fmtMoney(sum('grossEarnings'))} icon="account_balance_wallet" tone="sky" />
        <StatCard label="Income tax withheld" value={fmtMoney(sum('taxTotal'))} icon="account_balance" tone="amber" />
        <StatCard label="Net payout" value={fmtMoney(sum('netPay'))} icon="payments" tone="emerald" />
        <StatCard label="Overtime paid" value={fmtMoney(otPay)} icon="more_time" tone="purple" />
        <StatCard label="Loss of pay" value={fmtMoney(lopPay)} hint={`${slips.reduce((a, p) => a + p.attendance.lopDays, 0)} day(s)`} icon="money_off" tone="rose" />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs tabs={[{ id: 'register', label: 'Payroll register' }, { id: 'settings', label: 'Pay rules & tax' }]} value={tab} onChange={setTab} />
        {tab === 'register' && (
          <div className="flex gap-2">
            <Btn variant="outline" icon="download" onClick={exportRegister}>Register CSV</Btn>
            <Btn variant="outline" icon="account_balance" onClick={exportBankFile}>Bank transfer file</Btn>
          </div>
        )}
      </div>

      {tab === 'register' ? (
        <Card bodyClass="">
          <Table
            head={['Employee', 'Days (work / LOP)', 'OT hrs', { label: 'Gross', className: 'text-right' }, { label: 'Income tax', className: 'text-right' }, { label: 'EOBI / PF', className: 'text-right' }, { label: 'Net pay', className: 'text-right' }, { label: 'Employer cost', className: 'text-right' }, '']}
            minWidth="min-w-[1000px]"
          >
            {slips.map((p) => (
              <tr key={p.empId} className="hover:bg-slate-50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <Avatar emp={employeeByEmpId(p.empId) || p} size="w-8 h-8" />
                    <div>
                      <div className="font-bold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{p.empId} • {p.department}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono">
                  {p.attendance.workingDays} / <span className={p.attendance.lopDays ? 'text-rose-700 font-bold' : ''}>{p.attendance.lopDays}</span>
                </td>
                <td className="py-3 px-4 font-mono text-sky-700">{p.attendance.overtimeHours}</td>
                <td className="py-3 px-4 font-mono text-right">{fmtMoney(p.grossEarnings)}</td>
                <td className="py-3 px-4 font-mono text-right text-amber-700">{fmtMoney(p.taxTotal)}</td>
                <td className="py-3 px-4 font-mono text-right">{fmtMoney(benefit(p))}</td>
                <td className="py-3 px-4 font-mono text-right font-black text-emerald-700">{fmtMoney(p.netPay)}</td>
                <td className="py-3 px-4 font-mono text-right text-slate-500">{fmtMoney(p.employerCost)}</td>
                <td className="py-3 px-4 text-right"><Btn variant="ghost" icon="receipt" className="px-2 py-1" onClick={() => setSlip(p)}>Payslip</Btn></td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-bold">
              <td className="py-3 px-4" colSpan={3}>Totals</td>
              <td className="py-3 px-4 font-mono text-right">{fmtMoney(sum('grossEarnings'))}</td>
              <td className="py-3 px-4 font-mono text-right">{fmtMoney(sum('taxTotal'))}</td>
              <td className="py-3 px-4 font-mono text-right">{fmtMoney(slips.reduce((a, p) => a + benefit(p), 0))}</td>
              <td className="py-3 px-4 font-mono text-right text-emerald-700">{fmtMoney(sum('netPay'))}</td>
              <td className="py-3 px-4 font-mono text-right">{fmtMoney(sum('employerCost'))}</td>
              <td />
            </tr>
          </Table>
        </Card>
      ) : (
        <Card title="Pay rules" subtitle="Applied to draft runs. Income tax = FBR salaried slabs applied to annualised monthly gross, divided by 12.">
          <form onSubmit={saveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SETTING_FIELDS.map(([k, label]) => (
                <Field key={k} label={label}>
                  <input type="number" step="any" min="0" required value={settingsDraft[k]} onChange={(e) => setSettingsDraft({ ...settingsDraft, [k]: e.target.value })} className={inputCls} />
                </Field>
              ))}
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1.5">Income tax slabs (annual taxable income)</div>
              <div className="flex flex-wrap gap-2">
                {(payrollSettings?.taxBrackets || []).map((b, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-mono">
                    {b.rate}% {b.upTo ? `up to Rs ${b.upTo.toLocaleString()}` : 'above'}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Btn variant="outline" onClick={() => setSettingsDraft(payrollSettings)}>Discard</Btn>
              <Btn variant="dark" type="submit" icon="save">Save rules</Btn>
            </div>
          </form>
        </Card>
      )}

      {slip && <PayslipModal slip={slip} status={status} onClose={() => setSlip(null)} />}
    </Page>
  );
};
