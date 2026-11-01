import React, { useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { Btn, Card, EmptyRow, Field, Modal, Page, PageHeader, Table, inputCls } from '../common/ui';

const blankSchedule = { id: null, name: '', reportingTime: '09:00', lateAfter: '09:15', halfDayAfter: '11:00', normalOutTime: '18:00', remarks: '' };

export const SchedulesDesignationsView = ({ onShowToast }) => {
  const { shifts, designations, departments, employees, saveSchedule, addDesignation, setDesignationSchedule, addDepartment } = useHrms();
  const [scheduleForm, setScheduleForm] = useState(null);
  const [newDesignation, setNewDesignation] = useState({ name: '', scheduleId: '' });
  const [newDepartment, setNewDepartment] = useState('');

  const report = (res, title, msg) => (res.ok ? onShowToast(title, msg) : onShowToast('Not saved', res.error, 'error'));
  const staffOn = (designationId) => employees.filter((e) => e.designationId === designationId && e.active !== false).length;

  const submitSchedule = async (e) => {
    e.preventDefault();
    const res = await saveSchedule(scheduleForm);
    report(res, scheduleForm.id ? 'Schedule updated' : 'Schedule created', scheduleForm.name);
    if (res.ok) setScheduleForm(null);
  };

  return (
    <Page>
      <PageHeader
        kicker="TIME & ATTENDANCE"
        icon="schedule"
        title="Schedules, Designations & Departments"
        subtitle="Each designation follows a schedule; late and half-day rules come from that schedule."
        actions={<Btn icon="add" onClick={() => setScheduleForm({ ...blankSchedule })}>New schedule</Btn>}
      />

      <Card title="Schedules" subtitle="schedule table" bodyClass="">
        <Table head={['Schedule', 'Reporting', 'Late after', 'Half day after', 'Normal out', 'Standard hours', 'Remarks', '']} minWidth="min-w-[860px]">
          {shifts.length === 0 && <EmptyRow cols={8} text="No schedules yet." />}
          {shifts.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="py-3 px-4 font-bold text-slate-900">{s.name}</td>
              <td className="py-3 px-4 font-mono">{s.start}</td>
              <td className="py-3 px-4 font-mono text-amber-700">{s.lateAfter}</td>
              <td className="py-3 px-4 font-mono text-orange-700">{s.halfDayAfter}</td>
              <td className="py-3 px-4 font-mono">{s.end}</td>
              <td className="py-3 px-4 font-mono">{(s.standardMin / 60).toFixed(2)} h <span className="text-slate-400">(excl. 1 h break)</span></td>
              <td className="py-3 px-4 text-slate-500">{s.remarks || '—'}</td>
              <td className="py-3 px-4 text-right">
                <Btn variant="ghost" icon="edit" className="px-2 py-1" onClick={() => setScheduleForm({ id: s.dbId, name: s.name, reportingTime: s.start, lateAfter: s.lateAfter, halfDayAfter: s.halfDayAfter, normalOutTime: s.end, remarks: s.remarks })}>Edit</Btn>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Designations" subtitle="designations table — schedule assignment" className="lg:col-span-2" bodyClass="">
          <Table head={['Designation', 'Schedule', 'Active staff']} minWidth="min-w-[520px]">
            {designations.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="py-2.5 px-4 font-semibold text-slate-900">{d.name}</td>
                <td className="py-2.5 px-4">
                  <select
                    value={d.scheduleId || ''}
                    onChange={async (e) => report(await setDesignationSchedule(d.id, e.target.value || null), 'Schedule assigned', d.name)}
                    className={`${inputCls} w-56`}
                  >
                    <option value="">— No schedule —</option>
                    {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start}–{s.end})</option>)}
                  </select>
                </td>
                <td className="py-2.5 px-4 font-mono">{staffOn(d.id)}</td>
              </tr>
            ))}
          </Table>
          <form
            className="p-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await addDesignation(newDesignation);
              report(res, 'Designation added', newDesignation.name);
              if (res.ok) setNewDesignation({ name: '', scheduleId: '' });
            }}
          >
            <input required placeholder="New designation name" value={newDesignation.name} onChange={(e) => setNewDesignation({ ...newDesignation, name: e.target.value })} className={`${inputCls} flex-1`} />
            <select value={newDesignation.scheduleId} onChange={(e) => setNewDesignation({ ...newDesignation, scheduleId: e.target.value })} className={`${inputCls} sm:w-56`}>
              <option value="">— No schedule —</option>
              {shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Btn type="submit" icon="add">Add</Btn>
          </form>
        </Card>

        <Card title="Departments" subtitle="departments table" bodyClass="">
          <ul className="divide-y divide-slate-100 text-xs">
            {departments.map((d) => (
              <li key={d.id} className="flex justify-between px-4 py-2.5">
                <span className="font-semibold text-slate-800">{d.name}</span>
                <span className="font-mono text-slate-500">{employees.filter((e) => e.departmentId === d.id && e.active !== false).length}</span>
              </li>
            ))}
          </ul>
          <form
            className="p-4 border-t border-slate-200 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await addDepartment(newDepartment);
              report(res, 'Department added', newDepartment);
              if (res.ok) setNewDepartment('');
            }}
          >
            <input required placeholder="New department" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} className={`${inputCls} flex-1`} />
            <Btn type="submit" icon="add">Add</Btn>
          </form>
        </Card>
      </div>

      {scheduleForm && (
        <Modal title={scheduleForm.id ? 'Edit schedule' : 'New schedule'} onClose={() => setScheduleForm(null)}>
          <form onSubmit={submitSchedule} className="space-y-3">
            <Field label="Schedule name"><input required value={scheduleForm.name} onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              {[['reportingTime', 'Reporting time'], ['lateAfter', 'Late after'], ['halfDayAfter', 'Half day after'], ['normalOutTime', 'Normal out time']].map(([k, label]) => (
                <Field key={k} label={label}>
                  <input type="time" required value={scheduleForm[k]} onChange={(e) => setScheduleForm({ ...scheduleForm, [k]: e.target.value })} className={inputCls} />
                </Field>
              ))}
            </div>
            <Field label="Remarks"><input value={scheduleForm.remarks || ''} onChange={(e) => setScheduleForm({ ...scheduleForm, remarks: e.target.value })} className={inputCls} /></Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Btn variant="outline" onClick={() => setScheduleForm(null)}>Cancel</Btn>
              <Btn variant="dark" type="submit">Save</Btn>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
};
