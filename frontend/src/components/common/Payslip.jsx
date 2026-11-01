import React from 'react';
import { COMPANY } from '../../config/offices';
import { createPortal } from 'react-dom';
import { fmtMoney, monthLabel, periodRangeLabel } from '@shared/dates';
import { Btn, Modal } from './ui';

const Row = ({ label, amount, bold }) => (
  <div className={`flex items-center justify-between py-1.5 ${bold ? 'font-black text-slate-900 border-t border-slate-200 mt-1 pt-2' : 'text-slate-700'}`}>
    <span>{label}</span>
    <span className={`font-tabular-data ${amount < 0 ? 'text-rose-700' : ''}`}>{fmtMoney(amount)}</span>
  </div>
);

export const PayslipDocument = ({ slip, status }) => (
  <div className="bg-white text-xs text-slate-800 space-y-4">
    <div className="flex items-start justify-between border-b-2 border-[#0a2540] pb-3">
      <div>
        <div className="text-base font-black text-[#0a2540]">{COMPANY.name}</div>
        <div className="text-[11px] text-slate-500">{COMPANY.address}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-black">PAYSLIP</div>
        <div className="font-mono text-[11px]">{monthLabel(slip.monthKey)}<span className="block text-slate-500">{periodRangeLabel(slip.monthKey)}</span></div>
        {status && <div className={`text-[10px] font-mono font-bold ${status === 'FINALIZED' ? 'text-emerald-700' : 'text-amber-700'}`}>{status === 'FINALIZED' ? 'FINAL' : 'DRAFT — NOT FINAL'}</div>}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
      {[
        ['Employee', slip.name], ['Employee ID', slip.empId],
        ['Designation', slip.designation], ['Department', slip.department],
        ['CNIC', slip.cnic || '—'], ['Monthly gross salary', fmtMoney(slip.monthlySalary ?? 0)],
        ['Paid to', slip.bank ? `${slip.bank.bankName} ••••${slip.bank.accountLast4}` : '—'],
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2"><span className="text-slate-500">{k}</span><span className="font-semibold text-right">{v}</span></div>
      ))}
    </div>

    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-center">
      {[
        ['Working', slip.attendance.workingDays], ['Present', slip.attendance.present], ['Late', slip.attendance.late],
        ['Half day', slip.attendance.halfDay], ['Absent', slip.attendance.absent], ['Paid leave', slip.attendance.paidLeave],
        ['Unpaid', slip.attendance.unpaidLeave], ['OT hours', slip.attendance.overtimeHours],
      ].map(([k, v]) => (
        <div key={k} className="p-1.5 rounded bg-slate-50 border border-slate-100">
          <div className="text-[9px] font-mono text-slate-400 uppercase">{k}</div>
          <div className="font-black font-tabular-data">{v}</div>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Earnings</div>
        {slip.earnings.map((e) => <Row key={e.label} {...e} />)}
        <Row label="Gross earnings" amount={slip.grossEarnings} bold />
      </div>
      <div>
        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Deductions</div>
        {slip.deductions.map((d) => <Row key={d.label} {...d} />)}
        <Row label="Total deductions" amount={slip.totalDeductions} bold />
      </div>
    </div>

    <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a2540] text-white">
      <span className="font-bold">NET PAY</span>
      <span className="text-lg font-black font-tabular-data">{fmtMoney(slip.netPay)}</span>
    </div>

    <div>
      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-1">Employer-paid benefits (not deducted)</div>
      {slip.employerContributions.map((d) => <Row key={d.label} {...d} />)}
    </div>
    {slip.attendance.lopDays > 0 && (
      <p className="text-[10px] text-slate-500">
        Loss of pay {slip.attendance.lopDays} day(s): absences, unpaid leave, half days
        {slip.attendance.latePenaltyDays ? ` and ${slip.attendance.latePenaltyDays} day(s) for repeated late arrivals` : ''}.
      </p>
    )}
    <p className="text-[10px] text-slate-400">System-generated payslip based on recorded attendance and approved leave.</p>
  </div>
);

export const PayslipModal = ({ slip, status, onClose }) => (
  <>
    <Modal title={`Payslip — ${slip.name}`} subtitle={`${monthLabel(slip.monthKey)} (${periodRangeLabel(slip.monthKey)})`} onClose={onClose} width="max-w-3xl">
      <PayslipDocument slip={slip} status={status} />
      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
        <Btn variant="outline" onClick={onClose}>Close</Btn>
        <Btn variant="dark" icon="print" onClick={() => window.print()}>Print / Save PDF</Btn>
      </div>
    </Modal>
    {createPortal(
      <div className="print-only p-8">
        <PayslipDocument slip={slip} status={status} />
      </div>,
      document.body
    )}
  </>
);
