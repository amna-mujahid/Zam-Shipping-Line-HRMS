import React, { useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { fmtDate } from '@shared/dates';
import { Avatar, Btn, Card, Field, Page, PageHeader, inputCls } from '../common/ui';

const pickEditable = (e) => ({
  phone: e.phone || '',
  personalEmail: e.personalEmail || '',
  address: e.address || '',
  maritalStatus: e.maritalStatus || '',
  emergencyContact: { name: '', relation: '', phone: '', ...e.emergencyContact },
  bank: { bankName: '', accountNumber: '', branchCode: '', ...e.bank },
});

export const MyProfileView = ({ onShowToast }) => {
  const { currentUser, employeeByEmpId, shifts, offices, updateOwnProfile } = useHrms();
  const [form, setForm] = useState(() => pickEditable(currentUser));
  const set = (k, v) => setForm({ ...form, [k]: v });
  const setNested = (g, k, v) => setForm({ ...form, [g]: { ...form[g], [k]: v } });

  const submit = async (e) => {
    e.preventDefault();
    const res = await updateOwnProfile(form);
    if (res.ok) onShowToast('Profile updated', 'Your changes were saved and logged in the audit trail.');
    else onShowToast('Not saved', res.error, 'error');
  };

  const emp = currentUser;
  const readOnly = [
    ['Employee ID', emp.empId],
    ['CNIC', emp.cnic || '—'],
    ['Work email', emp.email],
    ['Department', emp.department],
    ['Designation', emp.designation],
    ['Reports to', employeeByEmpId(emp.managerId)?.name || '—'],
    ['Schedule', (() => { const s = shifts.find((x) => x.id === emp.shiftId); return s ? `${s.name} ${s.start}–${s.end}` : '—'; })()],
    ['Office', (offices.find((o) => o.id === emp.officeId) || offices[0])?.name],
    ['Joining date', fmtDate(emp.joiningDate)],
    ['Confirmation date', emp.confirmationDate ? fmtDate(emp.confirmationDate) : '—'],
    ['Employment status', emp.status],
    ['Date of birth', emp.dob ? fmtDate(emp.dob) : '—'],
  ];

  return (
    <Page>
      <PageHeader kicker="MY SELF-SERVICE" icon="person" title="My Profile" subtitle="Keep your personal, emergency and bank details up to date. Job details are maintained by HR." />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Employment details" subtitle="Contact HR to change these.">
          <div className="flex items-center gap-3 mb-4">
            <Avatar emp={emp} size="w-14 h-14" className="rounded-2xl" />
            <div>
              <div className="font-bold text-slate-900">{emp.name}</div>
              <div className="text-xs text-slate-500">{emp.designation}</div>
            </div>
          </div>
          <dl className="space-y-2 text-xs">
            {readOnly.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-semibold text-slate-900 text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {emp.jobHistory?.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-2">Job history</div>
              <ul className="space-y-1.5 text-[11px]">
                {[...emp.jobHistory].reverse().map((h, i) => (
                  <li key={i}><span className="font-mono text-slate-400">{fmtDate(h.date)}</span> — <strong>{h.event}</strong>: {h.title}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Personal information" className="lg:col-span-2">
          <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Mobile phone"><input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} /></Field>
              <Field label="Personal email"><input type="email" value={form.personalEmail} onChange={(e) => set('personalEmail', e.target.value)} className={inputCls} /></Field>
              <Field label="Home address" className="sm:col-span-2"><input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} /></Field>
              <Field label="Marital status">
                <select value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)} className={inputCls}>
                  <option value="">—</option><option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                </select>
              </Field>
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-2">Emergency contact</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Name"><input value={form.emergencyContact.name} onChange={(e) => setNested('emergencyContact', 'name', e.target.value)} className={inputCls} /></Field>
                <Field label="Relationship"><input value={form.emergencyContact.relation} onChange={(e) => setNested('emergencyContact', 'relation', e.target.value)} className={inputCls} /></Field>
                <Field label="Phone"><input value={form.emergencyContact.phone} onChange={(e) => setNested('emergencyContact', 'phone', e.target.value)} className={inputCls} /></Field>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase mb-2">Salary bank account</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Bank"><input value={form.bank.bankName} onChange={(e) => setNested('bank', 'bankName', e.target.value)} className={inputCls} /></Field>
                <Field label="Account number / IBAN"><input value={form.bank.accountNumber} onChange={(e) => setNested('bank', 'accountNumber', e.target.value)} className={inputCls} /></Field>
                <Field label="Branch code"><input value={form.bank.branchCode} onChange={(e) => setNested('bank', 'branchCode', e.target.value)} className={inputCls} /></Field>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">Bank changes apply from the next payroll run that is finalized.</p>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Btn variant="outline" onClick={() => setForm(pickEditable(currentUser))}>Discard</Btn>
              <Btn variant="dark" type="submit" icon="save">Save changes</Btn>
            </div>
          </form>
        </Card>
      </div>
    </Page>
  );
};
