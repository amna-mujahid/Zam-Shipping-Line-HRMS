import React, { useMemo, useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { PERMISSIONS } from '@shared/permissions';
import { STATUS_META } from '@shared/attendance';
import { addDays, fmtDate, fmtDuration, todayStr } from '@shared/dates';
import { downloadCSV } from '../../lib/csv';
import { Avatar, Btn, Card, EmptyRow, Field, Modal, Page, PageHeader, StatCard, StatusBadge, Table, inputCls } from '../common/ui';

// Quick marks. `matches` = derived statuses that count as already having this mark.
const MARKS = [
  { status: 'PRESENT', short: 'P', label: 'Present', on: 'bg-emerald-600 text-white border-emerald-600', off: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50', matches: ['PRESENT', 'WORKING', 'OFF_DAY_WORK', 'MISSED_PUNCH'] },
  { status: 'ABSENT', short: 'A', label: 'Absent', on: 'bg-rose-600 text-white border-rose-600', off: 'text-rose-700 border-rose-200 hover:bg-rose-50', matches: ['ABSENT'] },
  { status: 'LATE', short: 'L', label: 'Late', on: 'bg-amber-500 text-white border-amber-500', off: 'text-amber-700 border-amber-200 hover:bg-amber-50', matches: ['LATE'] },
  { status: 'HALF_DAY', short: 'HD', label: 'Half Day', on: 'bg-orange-500 text-white border-orange-500', off: 'text-orange-700 border-orange-200 hover:bg-orange-50', matches: ['HALF_DAY'] },
];

// Rows that "Mark all as Present" applies to: no attendance yet (or only the automatic
// "no check-in" absence) and not on leave / not yet joined.
const isUnmarked = (day) => (!day.record || day.record.method === 'Auto') && ['ABSENT', 'NOT_IN'].includes(day.status);

export const AttendanceView = ({ onShowToast }) => {
  const { employees, dayFor, can, saveAttendance, markAttendance } = useHrms();
  const [date, setDate] = useState(todayStr());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [dept, setDept] = useState('ALL');
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null); // empId being marked, or 'ALL'

  const canEdit = can(PERMISSIONS.ATTENDANCE_EDIT);
  const active = useMemo(() => employees.filter((e) => e.active !== false && !e.minimal), [employees]);
  const rows = useMemo(() => active.map((emp) => ({ emp, day: dayFor(emp, date) })), [active, dayFor, date]);
  const departments = ['ALL', ...new Set(active.map((e) => e.department))];
  const isFuture = date > todayStr();

  const filtered = rows.filter(({ emp, day }) => {
    const q = search.toLowerCase();
    return (
      (!q || emp.name.toLowerCase().includes(q) || emp.empId.toLowerCase().includes(q)) &&
      (status === 'ALL' || day.status === status) &&
      (dept === 'ALL' || emp.department === dept)
    );
  });

  const count = (...st) => rows.filter((r) => st.includes(r.day.status)).length;
  const totalOt = rows.reduce((a, r) => a + r.day.overtimeMinutes, 0);
  const flagged = rows.filter((r) => r.day.method === 'GPS' && r.day.location?.inFence === false).length;
  const unmarked = rows.filter((r) => isUnmarked(r.day));

  const mark = async (emp, markStatus) => {
    setBusy(emp.empId);
    const res = await markAttendance({ date, entries: [{ empId: emp.empId, status: markStatus }] });
    setBusy(null);
    if (res.ok) onShowToast('Attendance marked', `${emp.name} • ${STATUS_META[markStatus].label} • ${fmtDate(date)}`);
    else onShowToast('Not saved', res.error, 'error');
  };

  const markAllPresent = async () => {
    if (!unmarked.length) return;
    const names = unmarked.map((r) => r.emp.name).join(', ');
    if (!window.confirm(`Mark ${unmarked.length} employee(s) as Present for ${fmtDate(date)}?\n\n${names}\n\nEmployees who already have attendance, or are on leave, are not changed.`)) return;
    setBusy('ALL');
    const res = await markAttendance({ date, entries: unmarked.map((r) => ({ empId: r.emp.empId, status: 'PRESENT' })), notes: 'Bulk marked Present' });
    setBusy(null);
    if (res.ok) onShowToast('Marked all present', `${res.count} employee(s) marked Present for ${fmtDate(date)}.`);
    else onShowToast('Not saved', res.error, 'error');
  };

  const exportCsv = () => {
    downloadCSV(
      `Daily_Attendance_${date}.csv`,
      ['Emp ID', 'Name', 'Department', 'Schedule', 'Status', 'In', 'Out', 'Break (min)', 'Worked (h)', 'Late (min)', 'Overtime (h)', 'Method', 'Location', 'Notes'],
      filtered.map(({ emp, day }) => [
        emp.empId, emp.name, emp.department, `${day.shift.start}-${day.shift.end}`, STATUS_META[day.status].label,
        day.inTime || '', day.outTime || '', day.breakMinutes, (day.workedMinutes / 60).toFixed(2), day.lateMinutes,
        (day.overtimeMinutes / 60).toFixed(2), day.method || '', day.location?.label || '', day.notes,
      ])
    );
    onShowToast('Export complete', `Attendance for ${fmtDate(date)} downloaded.`);
  };

  const openEdit = ({ emp, day }) =>
    setEditing({ emp, date, inTime: day.inTime || day.shift.start, outTime: day.outTime || day.shift.end, breakMinutes: day.breakMinutes || 60, notes: '' });

  const submitEdit = async (e) => {
    e.preventDefault();
    const res = await saveAttendance(editing.emp.empId, editing.date, {
      inTime: editing.inTime, outTime: editing.outTime, breakMinutes: Number(editing.breakMinutes), notes: editing.notes,
    });
    if (res.ok) {
      onShowToast('Attendance saved', `${editing.emp.name} • ${fmtDate(editing.date)} updated.`);
      setEditing(null);
    } else onShowToast('Not saved', res.error, 'error');
  };

  const clearDay = async () => {
    const res = await saveAttendance(editing.emp.empId, editing.date, { inTime: null, notes: editing.notes || 'Attendance cleared' });
    if (res.ok) onShowToast('Attendance cleared', `${editing.emp.name} • ${fmtDate(editing.date)}`, 'info');
    else onShowToast('Not cleared', res.error, 'error');
    setEditing(null);
  };

  return (
    <Page>
      <PageHeader
        kicker="TIME & ATTENDANCE"
        icon="how_to_reg"
        title="Daily Attendance"
        subtitle={`${fmtDate(date)} • ${active.length} employees • Biometric, GPS, web & manual marking`}
        actions={
          <>
            <Btn variant="outline" icon="chevron_left" onClick={() => setDate(addDays(date, -1))} />
            <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${inputCls} w-auto`} />
            <Btn variant="outline" icon="chevron_right" onClick={() => setDate(addDays(date, 1))} disabled={date >= todayStr()} />
            <Btn variant="outline" icon="download" onClick={exportCsv}>Export CSV</Btn>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Present" value={count('PRESENT', 'WORKING', 'OFF_DAY_WORK')} icon="check_circle" tone="emerald" />
        <StatCard label="Late" value={count('LATE')} icon="schedule" tone="amber" />
        <StatCard label="Half day / Missed" value={count('HALF_DAY', 'MISSED_PUNCH')} icon="timelapse" tone="rose" />
        <StatCard label="Absent / not in" value={count('ABSENT', 'NOT_IN')} icon="person_off" tone="rose" />
        <StatCard label="On leave" value={count('ON_LEAVE')} icon="beach_access" tone="purple" />
        <StatCard label="Overtime" value={fmtDuration(totalOt)} hint={flagged ? `${flagged} GPS check-in(s) outside geofence` : 'No geofence flags'} icon="more_time" tone="sky" />
      </div>

      {canEdit && !isFuture && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-emerald-900">
            <strong>{unmarked.length}</strong> employee(s) have no attendance for {fmtDate(date)}.
            <span className="text-emerald-700"> Use the P / A / L / HD buttons to mark each person, or mark everyone present at once.</span>
          </div>
          <Btn variant="success" icon="done_all" onClick={markAllPresent} disabled={!unmarked.length || busy !== null}>
            {busy === 'ALL' ? 'Marking…' : `Mark all as Present (${unmarked.length})`}
          </Btn>
        </div>
      )}

      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or employee ID…" className={`${inputCls} flex-1`} />
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={`${inputCls} md:w-56`}>
          {departments.map((d) => <option key={d} value={d}>{d === 'ALL' ? 'All departments' : d}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputCls} md:w-48`}>
          <option value="ALL">All statuses</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <Card bodyClass="">
        <Table
          head={['Employee', ...(canEdit ? ['Mark'] : []), 'Status', 'In', 'Out', 'Breaks', 'Worked', 'Late', 'Overtime', 'Method / Location', ...(canEdit ? [{ label: '', className: 'text-right' }] : [])]}
          minWidth="min-w-[1200px]"
        >
          {filtered.length === 0 && <EmptyRow cols={11} />}
          {filtered.map(({ emp, day }) => {
            const markable = canEdit && !isFuture && !day.leave && day.status !== 'PRE_JOIN';
            return (
              <tr key={emp.empId} className="hover:bg-slate-50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar emp={emp} />
                    <div>
                      <div className="font-bold text-slate-900">{emp.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{emp.empId} • {emp.department}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{day.shift.name} {day.shift.start}–{day.shift.end}</div>
                    </div>
                  </div>
                </td>
                {canEdit && (
                  <td className="py-3 px-4">
                    {markable ? (
                      <div className="inline-flex gap-1" role="group" aria-label={`Mark attendance for ${emp.name}`}>
                        {MARKS.map((m) => {
                          const current = m.matches.includes(day.status);
                          return (
                            <button
                              key={m.status}
                              type="button"
                              title={m.label}
                              aria-pressed={current}
                              disabled={busy !== null || current}
                              onClick={() => mark(emp, m.status)}
                              className={`min-w-[34px] px-2 py-1 rounded-md border text-[11px] font-bold transition-colors disabled:cursor-default ${current ? m.on : `bg-white ${m.off}`} ${busy === emp.empId ? 'opacity-50' : ''}`}
                            >
                              {m.short}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400">{day.leave ? 'On approved leave' : isFuture ? '—' : ''}</span>
                    )}
                  </td>
                )}
                <td className="py-3 px-4">
                  <StatusBadge status={day.status} />
                  {day.record?.isManual && (
                    <div className="text-[10px] text-slate-400 mt-1">
                      {day.record.method === 'Auto' ? 'Auto: no check-in' : day.record.method === 'Leave' ? 'From approved leave' : 'Marked manually'}
                    </div>
                  )}
                  {day.leave && <div className="text-[10px] text-purple-700 mt-1">{day.leave.leaveType}</div>}
                  {day.holiday && <div className="text-[10px] text-blue-700 mt-1">{day.holiday.name}</div>}
                </td>
                <td className="py-3 px-4 font-mono font-bold text-emerald-700">{day.inTime || '--:--'}</td>
                <td className="py-3 px-4 font-mono">{day.outTime || '--:--'}</td>
                <td className="py-3 px-4 font-mono">{day.breakMinutes ? `${day.breakMinutes}m` : '—'}</td>
                <td className="py-3 px-4 font-mono font-bold">{day.workedMinutes ? fmtDuration(day.workedMinutes) : '—'}</td>
                <td className="py-3 px-4 font-mono text-amber-700">{day.lateMinutes ? `${day.lateMinutes}m` : '—'}</td>
                <td className="py-3 px-4 font-mono text-sky-700">{day.overtimeMinutes ? fmtDuration(day.overtimeMinutes) : '—'}</td>
                <td className="py-3 px-4 text-[11px]">
                  <div className="font-semibold text-slate-700">{day.method || '—'}</div>
                  {day.location?.label && (
                    <div className={day.method === 'GPS' && day.location.inFence === false ? 'text-amber-700' : 'text-slate-500'}>
                      {day.location.label}{day.method === 'GPS' && day.location.inFence === false ? ' • outside geofence' : ''}
                    </div>
                  )}
                </td>
                {canEdit && (
                  <td className="py-3 px-4 text-right">
                    {!isFuture && <Btn variant="ghost" icon="edit" onClick={() => openEdit({ emp, day })} className="px-2 py-1">Times</Btn>}
                  </td>
                )}
              </tr>
            );
          })}
        </Table>
      </Card>

      {canEdit && (
        <p className="text-[11px] text-slate-500">
          <strong>P</strong> Present • <strong>A</strong> Absent • <strong>L</strong> Late • <strong>HD</strong> Half Day. Marking keeps any punch times already recorded; Absent clears them. Use “Times” to enter exact check-in / check-out.
        </p>
      )}

      {editing && (
        <Modal title="Attendance times" subtitle={`${editing.emp.name} • ${fmtDate(editing.date)}`} onClose={() => setEditing(null)}>
          <form onSubmit={submitEdit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Check-in"><input type="time" required value={editing.inTime} onChange={(e) => setEditing({ ...editing, inTime: e.target.value })} className={inputCls} /></Field>
              <Field label="Check-out"><input type="time" value={editing.outTime} onChange={(e) => setEditing({ ...editing, outTime: e.target.value })} className={inputCls} /></Field>
              <Field label="Break (min)"><input type="number" min="0" max="240" value={editing.breakMinutes} onChange={(e) => setEditing({ ...editing, breakMinutes: e.target.value })} className={inputCls} /></Field>
            </div>
            <Field label="Reason (recorded in audit log)">
              <textarea required rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} className={inputCls} placeholder="e.g. Biometric terminal down — times confirmed by supervisor" />
            </Field>
            <p className="text-[11px] text-slate-500">Status (Present / Late / Half Day) is calculated from these times and the employee's schedule.</p>
            <div className="flex justify-between gap-2 pt-3 border-t border-slate-200">
              <Btn variant="outline" icon="delete" onClick={clearDay}>Clear day</Btn>
              <div className="flex gap-2">
                <Btn variant="outline" onClick={() => setEditing(null)}>Cancel</Btn>
                <Btn variant="dark" type="submit">Save</Btn>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
};
