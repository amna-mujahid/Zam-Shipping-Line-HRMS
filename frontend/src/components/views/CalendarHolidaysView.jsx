import React, { useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { PERMISSIONS } from '@shared/permissions';
import { dayName, fmtDate, todayStr } from '@shared/dates';
import { Btn, Card, EmptyRow, Field, Modal, Page, PageHeader, Table, inputCls } from '../common/ui';

export const CalendarHolidaysView = ({ onShowToast }) => {
  const { holidays, can, addHoliday, removeHoliday, countLeaveDays } = useHrms();
  const canManage = can(PERMISSIONS.EMPLOYEE_DIRECTORY);
  const [form, setForm] = useState(null);
  const today = todayStr();
  const sorted = [...holidays].sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  const upcoming = sorted.filter((h) => h.toDate >= today);

  const submit = async (e) => {
    e.preventDefault();
    if (form.toDate < form.fromDate) return onShowToast('Check dates', 'End date must be on or after start date.', 'error');
    const res = await addHoliday(form);
    if (!res.ok) return onShowToast('Not saved', res.error, 'error');
    onShowToast('Holiday added', `${form.name} added; the calendar marks these days as Holiday.`);
    setForm(null);
    return undefined;
  };

  return (
    <Page>
      <PageHeader
        kicker="LEAVE"
        icon="celebration"
        title="Company Holidays"
        subtitle="Paid days off. Holidays are excluded from working days for attendance, leave and payroll."
        actions={canManage && <Btn icon="add" onClick={() => setForm({ name: '', fromDate: today, toDate: today, division: 'All Offices' })}>Add holiday</Btn>}
      />
      {upcoming[0] && (
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined">event</span>
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-sky-700 uppercase">Next holiday</div>
            <div className="text-base font-bold text-slate-900">{upcoming[0].name}</div>
            <div className="text-xs text-slate-600">{fmtDate(upcoming[0].fromDate)} ({dayName(upcoming[0].fromDate)})</div>
          </div>
        </div>
      )}
      <Card bodyClass="">
        <Table head={['Holiday', 'Dates', 'Working days off', 'Status', ...(canManage ? [''] : [])]} minWidth="min-w-[700px]">
          {sorted.length === 0 && <EmptyRow cols={6} />}
          {sorted.map((h) => (
            <tr key={h.id} className={`hover:bg-slate-50 ${h.toDate < today ? 'text-slate-400' : ''}`}>
              <td className="py-3 px-4 font-bold">{h.name}</td>
              <td className="py-3 px-4 font-mono whitespace-nowrap">{fmtDate(h.fromDate)}{h.toDate !== h.fromDate ? ` → ${fmtDate(h.toDate)}` : ''}</td>
              <td className="py-3 px-4 font-mono">{countLeaveDays(h.fromDate, h.toDate) || '—'}</td>
              <td className="py-3 px-4 text-[11px] font-mono font-bold">{h.toDate < today ? 'PAST' : 'UPCOMING'}</td>
              {canManage && (
                <td className="py-3 px-4 text-right">
                  <Btn variant="ghost" icon="delete" className="px-2 py-1" onClick={async () => { if (!window.confirm(`Remove ${h.name}?`)) return; const r = await removeHoliday(h.id); if (!r.ok) onShowToast('Not removed', r.error, 'error'); }}>Remove</Btn>
                </td>
              )}
            </tr>
          ))}
        </Table>
      </Card>
      {form && (
        <Modal title="Add company holiday" onClose={() => setForm(null)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Holiday name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><input type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} className={inputCls} /></Field>
              <Field label="To"><input type="date" required value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Btn variant="outline" onClick={() => setForm(null)}>Cancel</Btn>
              <Btn variant="dark" type="submit">Add</Btn>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
};
