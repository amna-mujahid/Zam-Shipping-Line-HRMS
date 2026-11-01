import React, { useMemo, useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { PERMISSIONS } from '@shared/permissions';
import { STATUS_META, computeRange, summarizeDays } from '@shared/attendance';
import { fmtDate, fmtDuration, monthDates, monthKeyOf, monthLabel, parseDate, periodRangeLabel, shiftMonth, todayStr } from '@shared/dates';
import { downloadCSV } from '../../lib/csv';
import { Avatar, Btn, Card, Field, Modal, Page, PageHeader, StatCard, StatusBadge, Table, Tabs, inputCls } from '../common/ui';

export const EmployeeMonthlyAttendanceView = ({ onShowToast }) => {
  const { currentUser, employees, can, attendanceCtx, submitRegularization, saveAttendance } = useHrms();
  const scopeAll = can(PERMISSIONS.ATTENDANCE_ALL);
  const canEdit = can(PERMISSIONS.ATTENDANCE_EDIT);
  const canRequest = can(PERMISSIONS.REGULARIZE_REQUEST);

  const thisMonth = monthKeyOf(todayStr());
  const [empId, setEmpId] = useState(currentUser.empId);
  const [month, setMonth] = useState(thisMonth);
  const [mode, setMode] = useState('TABLE');
  const [filter, setFilter] = useState('ALL');
  const [form, setForm] = useState(null);

  // Employees can only ever load their own sheet, regardless of UI state.
  const emp = (scopeAll ? employees.find((e) => e.empId === empId) : null) || currentUser;
  const days = useMemo(() => computeRange(emp, monthDates(month), attendanceCtx), [emp, month, attendanceCtx]);
  const s = useMemo(() => summarizeDays(days), [days]);
  const shown = days.filter((d) => filter === 'ALL' || d.status === filter);

  const exportCsv = () => {
    downloadCSV(
      `Timesheet_${emp.empId}_${month}.csv`,
      ['Date', 'Day', 'Status', 'In', 'Out', 'Break (min)', 'Worked (h)', 'Late (min)', 'Overtime (h)', 'Method', 'Notes'],
      days.map((d) => [d.date, d.day, STATUS_META[d.status].label, d.inTime || '', d.outTime || '', d.breakMinutes, (d.workedMinutes / 60).toFixed(2), d.lateMinutes, (d.overtimeMinutes / 60).toFixed(2), d.method || '', d.leave ? d.leave.leaveType : d.holiday ? d.holiday.name : d.notes])
    );
    onShowToast('Timesheet exported', `${emp.name} • ${monthLabel(month)}`);
  };

  const openRow = (d) => {
    if (d.date > todayStr()) return;
    if (canEdit) setForm({ kind: 'edit', date: d.date, inTime: d.inTime || d.shift.start, outTime: d.outTime || d.shift.end, breakMinutes: d.breakMinutes || 60, reason: '' });
    else if (canRequest && emp.empId === currentUser.empId) setForm({ kind: 'request', date: d.date, inTime: d.inTime || d.shift.start, outTime: d.outTime || d.shift.end, reason: '' });
  };

  const submit = async (e) => {
    e.preventDefault();
    const res =
      form.kind === 'edit'
        ? await saveAttendance(emp.empId, form.date, { inTime: form.inTime, outTime: form.outTime, breakMinutes: Number(form.breakMinutes), notes: form.reason })
        : await submitRegularization({ date: form.date, requestedIn: form.inTime, requestedOut: form.outTime, reason: form.reason });
    if (res.ok) onShowToast(form.kind === 'edit' ? 'Attendance updated' : 'Correction submitted', form.kind === 'edit' ? `${fmtDate(form.date)} saved.` : `${res.reqCode} sent to your attendance manager.`);
    else return onShowToast('Not saved', res.error, 'error');
    setForm(null);
  };

  const actionable = canEdit || (canRequest && emp.empId === currentUser.empId);
  const firstWeekday = parseDate(days[0].date).getDay();

  return (
    <Page>
      <PageHeader
        kicker={scopeAll ? 'TIME & ATTENDANCE' : 'MY SELF-SERVICE'}
        icon="calendar_month"
        title={scopeAll ? 'Monthly Timesheet' : 'My Attendance'}
        subtitle={`${monthLabel(month)} (${periodRangeLabel(month)}) • ${emp.name} (${emp.empId})`}
        actions={
          <>
            {scopeAll && (
              <select value={emp.empId} onChange={(e) => setEmpId(e.target.value)} className={`${inputCls} w-auto`}>
                {employees.filter((x) => x.active !== false && !x.minimal).map((x) => <option key={x.empId} value={x.empId}>{x.name} ({x.empId})</option>)}
              </select>
            )}
            <Btn variant="outline" icon="chevron_left" onClick={() => setMonth(shiftMonth(month, -1))} />
            <span className="text-xs font-bold font-mono text-slate-800 min-w-28 text-center leading-tight">{monthLabel(month)}<span className="block text-[10px] font-normal text-slate-500">{periodRangeLabel(month)}</span></span>
            <Btn variant="outline" icon="chevron_right" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} />
            <Btn variant="outline" icon="download" onClick={exportCsv}>CSV</Btn>
          </>
        }
      />

      <div className="flex items-center gap-4 bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
        <Avatar emp={emp} size="w-12 h-12" />
        <div className="min-w-0">
          <div className="font-bold text-slate-900">{emp.name}</div>
          <div className="text-xs text-slate-500">{emp.designation} • {emp.department}</div>
          <div className="text-[11px] font-mono text-slate-500">{days[0].shift.name} {days[0].shift.start}–{days[0].shift.end}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] font-mono text-slate-400 uppercase">Attendance rate</div>
          <div className="text-xl font-black text-emerald-700 font-tabular-data">{s.attendanceRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard label="Working days" value={s.workingDays} />
        <StatCard label="Present" value={s.present} hint={`${s.late} late`} />
        <StatCard label="Half / missed" value={s.halfDay + s.missedPunch} />
        <StatCard label="Absent" value={s.absent} />
        <StatCard label="Leave" value={s.paidLeave + s.unpaidLeave} hint={s.unpaidLeave ? `${s.unpaidLeave} unpaid` : 'all paid'} />
        <StatCard label="Holidays" value={s.holidays} />
        <StatCard label="Worked" value={fmtDuration(s.workedMinutes)} />
        <StatCard label="Overtime" value={fmtDuration(s.overtimeMinutes)} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs tabs={[{ id: 'TABLE', label: 'Table' }, { id: 'CALENDAR', label: 'Calendar' }]} value={mode} onChange={setMode} />
        {mode === 'TABLE' && (
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputCls} sm:w-48`}>
            <option value="ALL">All days</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
      </div>

      {mode === 'TABLE' ? (
        <Card bodyClass="">
          <Table head={['Date', 'Status', 'In', 'Out', 'Breaks', 'Worked', 'Late', 'Overtime', 'Method', 'Notes', ...(actionable ? [''] : [])]} minWidth="min-w-[1000px]">
            {shown.map((d) => (
              <tr key={d.date} className="hover:bg-slate-50">
                <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">{fmtDate(d.date)} <span className="text-slate-400 font-normal">{d.day.slice(0, 3)}</span></td>
                <td className="py-2.5 px-4"><StatusBadge status={d.status} /></td>
                <td className="py-2.5 px-4 font-mono">{d.inTime || '--:--'}</td>
                <td className="py-2.5 px-4 font-mono">{d.outTime || '--:--'}</td>
                <td className="py-2.5 px-4 font-mono">{d.breakMinutes ? `${d.breakMinutes}m` : '—'}</td>
                <td className="py-2.5 px-4 font-mono font-bold">{d.workedMinutes ? fmtDuration(d.workedMinutes) : '—'}</td>
                <td className="py-2.5 px-4 font-mono text-amber-700">{d.lateMinutes ? `${d.lateMinutes}m` : '—'}</td>
                <td className="py-2.5 px-4 font-mono text-sky-700">{d.overtimeMinutes ? fmtDuration(d.overtimeMinutes) : '—'}</td>
                <td className="py-2.5 px-4 text-slate-500">{d.method || '—'}</td>
                <td className="py-2.5 px-4 text-[11px] text-slate-500 max-w-[220px] truncate">{d.leave ? d.leave.leaveType : d.holiday ? d.holiday.name : d.notes}</td>
                {actionable && (
                  <td className="py-2.5 px-4 text-right">
                    {d.date <= todayStr() && d.isWorkingDay && !d.leave && (
                      <Btn variant="ghost" className="px-2 py-1" icon={canEdit ? 'edit' : 'edit_calendar'} onClick={() => openRow(d)}>
                        {canEdit ? 'Edit' : 'Correct'}
                      </Btn>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </Table>
        </Card>
      ) : (
        <Card>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono font-bold text-slate-400 uppercase mb-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => actionable && d.isWorkingDay && !d.leave && openRow(d)}
                className={`min-h-[72px] rounded-lg border p-1.5 text-left ${STATUS_META[d.status].cls}`}
              >
                <div className="text-xs font-black">{Number(d.date.slice(8))}</div>
                <div className="text-[9px] font-mono font-bold leading-tight mt-0.5">{STATUS_META[d.status].label}</div>
                {d.workedMinutes > 0 && <div className="text-[9px] font-mono mt-0.5">{fmtDuration(d.workedMinutes)}</div>}
              </button>
            ))}
          </div>
        </Card>
      )}

      {form && (
        <Modal
          title={form.kind === 'edit' ? 'Edit attendance' : 'Request attendance correction'}
          subtitle={`${emp.name} • ${fmtDate(form.date)}`}
          onClose={() => setForm(null)}
        >
          <form onSubmit={submit} className="space-y-3">
            <div className={`grid gap-3 ${form.kind === 'edit' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <Field label="Check-in"><input type="time" required value={form.inTime} onChange={(e) => setForm({ ...form, inTime: e.target.value })} className={inputCls} /></Field>
              <Field label="Check-out"><input type="time" required value={form.outTime} onChange={(e) => setForm({ ...form, outTime: e.target.value })} className={inputCls} /></Field>
              {form.kind === 'edit' && (
                <Field label="Break (min)"><input type="number" min="0" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} className={inputCls} /></Field>
              )}
            </div>
            <Field label="Reason">
              <textarea required rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={inputCls} placeholder="Explain what happened (e.g. forgot to badge out, transit delay)" />
            </Field>
            {form.kind === 'request' && <p className="text-[11px] text-slate-500">Your request goes to the attendance manager. Payroll uses the corrected times once approved.</p>}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Btn variant="outline" onClick={() => setForm(null)}>Cancel</Btn>
              <Btn variant="dark" type="submit">{form.kind === 'edit' ? 'Save' : 'Submit request'}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
};
