import React, { useMemo, useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { ROLE_LABELS } from '@shared/permissions';
import { ROLES } from '@shared/roles';
import { computeRange, summarizeDays } from '@shared/attendance';
import { fmtDate, fmtDuration, fmtMoney0, monthDates, monthKeyOf, todayStr } from '@shared/dates';
import { downloadCSV } from '../../lib/csv';
import { Avatar, Btn, Card, EmptyRow, Field, Icon, Modal, Page, PageHeader, Table, Tabs, inputCls } from '../common/ui';

// Allowed by chk_emp_status / chk_emp_type in zam_hrms.sql
const STATUSES = ['Probation', 'Permanent', 'Inactive', 'Terminated'];
const TYPES = ['Internal', 'External_Parent'];

const blankEmployee = (departments, designations) => ({
  empId: '', name: '', email: '', phone: '', cnic: '',
  departmentId: departments[0]?.id || '', designationId: designations[0]?.id || '',
  managerId: '', officeId: '', joiningDate: todayStr(), confirmationDate: '',
  status: 'Probation', employeeType: 'Internal', grossSalary: 50000,
  dob: '', gender: '', maritalStatus: '', address: '', personalEmail: '',
  emergencyContact: { name: '', relation: '', phone: '' },
  bank: { bankName: '', accountNumber: '', branchCode: '' },
  createLogin: true, username: '', password: '', role: ROLES.EMPLOYEE,
});

const InfoGrid = ({ items }) => (
  <div className="grid grid-cols-2 gap-2.5 text-xs">
    {items.map(([k, v]) => (
      <div key={k} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 min-w-0">
        <div className="text-[10px] text-slate-400 uppercase font-mono">{k}</div>
        <div className="text-slate-900 font-medium truncate">{v || '—'}</div>
      </div>
    ))}
  </div>
);

const EmployeeForm = ({ value, onChange, employees, departments, designations, shifts, offices, isNew }) => {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const setNested = (group, k, v) => onChange({ ...value, [group]: { ...value[group], [k]: v } });
  const schedule = shifts.find((s) => s.id === designations.find((d) => d.id === Number(value.designationId))?.scheduleId);
  return (
    <div className="space-y-4">
      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">Job & compensation</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={isNew ? 'Employee ID (blank = auto)' : 'Employee ID'}>
          <input disabled={!isNew} inputMode="numeric" value={value.empId} onChange={(e) => set('empId', e.target.value.replace(/\D/g, ''))} className={inputCls} />
        </Field>
        <Field label="Full name *"><input required value={value.name} onChange={(e) => set('name', e.target.value)} className={inputCls} /></Field>
        <Field label="CNIC * (12345-1234567-1)">
          <input required pattern="\d{5}-\d{7}-\d" value={value.cnic} onChange={(e) => set('cnic', e.target.value)} className={inputCls} placeholder="35202-1234567-1" />
        </Field>
        <Field label="Phone *"><input required value={value.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="0300-1234567" /></Field>
        <Field label="Work email"><input type="email" value={value.email} onChange={(e) => set('email', e.target.value)} className={inputCls} /></Field>
        <Field label="Department *">
          <select required value={value.departmentId} onChange={(e) => set('departmentId', Number(e.target.value))} className={inputCls}>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Designation *">
          <select required value={value.designationId} onChange={(e) => set('designationId', Number(e.target.value))} className={inputCls}>
            {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Schedule (from designation)">
          <input disabled value={schedule ? `${schedule.name} ${schedule.start}–${schedule.end}` : 'No schedule assigned'} className={inputCls} />
        </Field>
        <Field label="Reports to">
          <select value={value.managerId || ''} onChange={(e) => set('managerId', e.target.value || null)} className={inputCls}>
            <option value="">— None (top of org) —</option>
            {employees.filter((e) => e.empId !== value.empId).map((e) => <option key={e.empId} value={e.empId}>{e.name} ({e.empId})</option>)}
          </select>
        </Field>
        <Field label="Office (GPS check-in)">
          <select value={value.officeId || ''} onChange={(e) => set('officeId', e.target.value)} className={inputCls}>
            <option value="">Default office</option>
            {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Field>
        <Field label="Joining date *"><input type="date" required value={value.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} className={inputCls} /></Field>
        <Field label="Confirmation date"><input type="date" value={value.confirmationDate || ''} onChange={(e) => set('confirmationDate', e.target.value)} className={inputCls} /></Field>
        <Field label="Status">
          <select value={value.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Employee type">
          <select value={value.employeeType} onChange={(e) => set('employeeType', e.target.value)} className={inputCls}>
            {TYPES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </Field>
        <Field label="Monthly gross salary (Rs) *" className="col-span-2">
          <input type="number" min="0" step="any" required value={value.grossSalary} onChange={(e) => set('grossSalary', e.target.value)} className={inputCls} />
        </Field>
      </div>

      {isNew && (
        <>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={value.createLogin} onChange={(e) => set('createLogin', e.target.checked)} />
            Create a login account
          </label>
          {value.createLogin && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Username (blank = employee ID)"><input value={value.username} onChange={(e) => set('username', e.target.value)} className={inputCls} /></Field>
              <Field label="Initial password *"><input required minLength={4} value={value.password} onChange={(e) => set('password', e.target.value)} className={inputCls} /></Field>
              <Field label="Access role">
                <select value={value.role} onChange={(e) => set('role', e.target.value)} className={inputCls}>
                  <option value={ROLES.EMPLOYEE}>Employee</option>
                  <option value={ROLES.MANAGER}>Department Head (Manager)</option>
                  <option value={ROLES.OWNER}>HR (Owner)</option>
                </select>
              </Field>
            </div>
          )}
        </>
      )}

      <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">Personal & contacts</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of birth"><input type="date" value={value.dob || ''} onChange={(e) => set('dob', e.target.value)} className={inputCls} /></Field>
        <Field label="Gender">
          <select value={value.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>
            <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
          </select>
        </Field>
        <Field label="Address" className="col-span-2"><input value={value.address} onChange={(e) => set('address', e.target.value)} className={inputCls} /></Field>
        <Field label="Emergency contact"><input value={value.emergencyContact.name} onChange={(e) => setNested('emergencyContact', 'name', e.target.value)} className={inputCls} /></Field>
        <Field label="Relation / phone">
          <div className="flex gap-2">
            <input value={value.emergencyContact.relation} placeholder="Relation" onChange={(e) => setNested('emergencyContact', 'relation', e.target.value)} className={inputCls} />
            <input value={value.emergencyContact.phone} placeholder="Phone" onChange={(e) => setNested('emergencyContact', 'phone', e.target.value)} className={inputCls} />
          </div>
        </Field>
        <Field label="Bank name"><input value={value.bank.bankName} onChange={(e) => setNested('bank', 'bankName', e.target.value)} className={inputCls} /></Field>
        <Field label="Account / IBAN • branch code">
          <div className="flex gap-2">
            <input value={value.bank.accountNumber} placeholder="Account / IBAN" onChange={(e) => setNested('bank', 'accountNumber', e.target.value)} className={inputCls} />
            <input value={value.bank.branchCode} placeholder="Branch" onChange={(e) => setNested('bank', 'branchCode', e.target.value)} className={`${inputCls} w-24`} />
          </div>
        </Field>
      </div>
    </div>
  );
};

export const EmployeesView = ({ onShowToast }) => {
  const { employees, departments, designations, shifts, offices, attendanceCtx, employeeByEmpId, addEmployee, updateEmployee, leaveBalances } = useHrms();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [dept, setDept] = useState('ALL');
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [form, setForm] = useState(null); // { isNew, value, note }
  const [saving, setSaving] = useState(false);

  const deptNames = ['ALL', ...new Set(employees.map((e) => e.department))];
  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return (
      (!q || [e.name, e.empId, e.email, e.designation, e.cnic].some((x) => String(x || '').toLowerCase().includes(q))) &&
      (status === 'ALL' || e.status === status) &&
      (dept === 'ALL' || e.department === dept)
    );
  });

  const exportCsv = () => {
    downloadCSV(
      `Employee_Directory_${todayStr()}.csv`,
      ['Emp ID', 'Name', 'CNIC', 'Email', 'Phone', 'Department', 'Designation', 'Reports To', 'Joining Date', 'Confirmation Date', 'Status', 'Type', 'Monthly Gross (Rs)'],
      filtered.map((e) => [e.empId, e.name, e.cnic, e.email, e.phone, e.department, e.designation, employeeByEmpId(e.managerId)?.name || '', e.joiningDate, e.confirmationDate, e.status, e.employeeType, e.grossSalary])
    );
    onShowToast('Export complete', `${filtered.length} employee records downloaded.`);
  };

  const submitForm = async (ev) => {
    ev.preventDefault();
    const { isNew, value, note } = form;
    const payload = { ...value, grossSalary: Number(value.grossSalary) };
    setSaving(true);
    let res;
    if (isNew) {
      const { createLogin, ...rest } = payload;
      res = await addEmployee(createLogin ? rest : { ...rest, password: '' });
    } else {
      const patch = {
        name: payload.name, email: payload.email, phone: payload.phone, cnic: payload.cnic,
        departmentId: payload.departmentId, designationId: payload.designationId, managerId: payload.managerId || null,
        officeId: payload.officeId, joiningDate: payload.joiningDate, confirmationDate: payload.confirmationDate,
        status: payload.status, employeeType: payload.employeeType, grossSalary: payload.grossSalary,
        dob: payload.dob, gender: payload.gender, address: payload.address, emergencyContact: payload.emergencyContact, bank: payload.bank,
      };
      res = await updateEmployee(value.empId, patch, note);
    }
    setSaving(false);
    if (!res.ok) return onShowToast('Not saved', res.error, 'error');
    onShowToast(isNew ? 'Employee added' : 'Record updated', `${value.name}${res.empId ? ` (${res.empId})` : ''}`);
    setForm(null);
    if (!isNew) setSelected(value.empId);
    return undefined;
  };

  const sel = selected ? employeeByEmpId(selected) : null;
  const selMonth = useMemo(() => {
    if (!sel) return null;
    return summarizeDays(computeRange(sel, monthDates(monthKeyOf(todayStr())), attendanceCtx));
  }, [sel, attendanceCtx]);

  const shiftOf = (e) => shifts.find((s) => s.id === e.shiftId);

  return (
    <Page>
      <PageHeader
        kicker="PEOPLE"
        icon="badge"
        title="Employee Directory"
        subtitle={`${employees.filter((e) => e.active !== false).length} active employees • ${departments.length} departments`}
        actions={
          <>
            <Btn icon="person_add" disabled={!departments.length || !designations.length} onClick={() => setForm({ isNew: true, value: blankEmployee(departments, designations), note: '' })}>Add employee</Btn>
            <Btn variant="outline" icon="download" onClick={exportCsv}>Export CSV</Btn>
          </>
        }
      />

      <Tabs
        value={status}
        onChange={setStatus}
        tabs={[{ id: 'ALL', label: `All (${employees.length})` }, ...STATUSES.map((s) => ({ id: s, label: `${s} (${employees.filter((e) => e.status === s).length})` }))]}
      />

      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, CNIC, email or designation…" className={`${inputCls} flex-1`} />
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={`${inputCls} md:w-56`}>
          {deptNames.map((d) => <option key={d} value={d}>{d === 'ALL' ? 'All departments' : d}</option>)}
        </select>
      </div>

      <Card bodyClass="">
        <Table head={['Employee', 'Department & designation', 'Reports to', 'Schedule', 'Status', 'Login', { label: 'Monthly salary', className: 'text-right' }, '']} minWidth="min-w-[1050px]">
          {filtered.length === 0 && <EmptyRow cols={8} />}
          {filtered.map((e) => (
            <tr key={e.empId} className={`hover:bg-slate-50 ${e.active === false ? 'opacity-50' : ''}`}>
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <Avatar emp={e} />
                  <div>
                    <div className="font-bold text-slate-900">{e.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{e.empId} • {e.cnic}</div>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="font-semibold text-slate-900">{e.designation}</div>
                <div className="text-[10px] text-slate-500 font-mono">{e.department}</div>
              </td>
              <td className="py-3 px-4 text-slate-700">{employeeByEmpId(e.managerId)?.name || '—'}</td>
              <td className="py-3 px-4 text-[11px] font-mono text-slate-600">{shiftOf(e) ? `${shiftOf(e).start}–${shiftOf(e).end}` : '—'}</td>
              <td className="py-3 px-4">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${e.status === 'Permanent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : e.status === 'Probation' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  {e.status}
                </span>
              </td>
              <td className="py-3 px-4 text-[11px] font-mono font-bold text-slate-600">{e.hasAccount ? ROLE_LABELS[e.role] : <span className="text-slate-400 font-normal">No login</span>}</td>
              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{fmtMoney0(e.grossSalary)}</td>
              <td className="py-3 px-4 text-right">
                <Btn variant="ghost" icon="visibility" className="px-2 py-1" onClick={() => { setSelected(e.empId); setDetailTab('overview'); }}>View</Btn>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      {sel && (
        <Modal title="Personnel record" subtitle={`${sel.empId} • ${sel.hasAccount ? `${ROLE_LABELS[sel.role]} login (${sel.username})` : 'no login account'}`} onClose={() => setSelected(null)} width="max-w-2xl">
          <div className="flex items-center gap-4">
            <Avatar emp={sel} size="w-16 h-16" className="rounded-2xl border-2 border-sky-500" />
            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-bold text-slate-900">{sel.name}</h4>
              <div className="text-xs text-slate-500">{sel.designation} • {sel.department}</div>
              <div className="text-[11px] font-mono text-sky-700">{sel.email || 'no email'} • {sel.phone}</div>
            </div>
            <Btn variant="outline" icon="edit" onClick={() => { setForm({ isNew: false, value: { ...sel, managerId: sel.managerId || '' }, note: '' }); setSelected(null); }}>Edit</Btn>
          </div>
          <Tabs
            value={detailTab}
            onChange={setDetailTab}
            tabs={[{ id: 'overview', label: 'Overview' }, { id: 'history', label: 'Job history' }, { id: 'attendance', label: 'Attendance & leave' }]}
          />
          {detailTab === 'overview' && (
            <InfoGrid
              items={[
                ['CNIC', sel.cnic],
                ['Employee type', sel.employeeType?.replace('_', ' ')],
                ['Reports to', employeeByEmpId(sel.managerId)?.name],
                ['Direct reports', employees.filter((e) => e.managerId === sel.empId).map((e) => e.name).join(', ')],
                ['Schedule', shiftOf(sel) && `${shiftOf(sel).name} ${shiftOf(sel).start}–${shiftOf(sel).end}`],
                ['Status', sel.status],
                ['Joining date', sel.joiningDate && fmtDate(sel.joiningDate)],
                ['Confirmation date', sel.confirmationDate && fmtDate(sel.confirmationDate)],
                ['Monthly gross salary', fmtMoney0(sel.grossSalary)],
                ['Date of birth', sel.dob && fmtDate(sel.dob)],
                ['Gender / marital', [sel.gender, sel.maritalStatus].filter(Boolean).join(' • ')],
                ['Personal email', sel.personalEmail],
                ['Address', sel.address],
                ['Emergency contact', sel.emergencyContact?.name && `${sel.emergencyContact.name} (${sel.emergencyContact.relation}) ${sel.emergencyContact.phone}`],
                ['Bank', sel.bank?.bankName && `${sel.bank.bankName} ••••${(sel.bank.accountNumber || '').slice(-4)}`],
              ]}
            />
          )}
          {detailTab === 'history' && (
            sel.jobHistory?.length ? (
              <ol className="relative border-l-2 border-sky-100 ml-2 space-y-4">
                {[...sel.jobHistory].reverse().map((h, i) => (
                  <li key={i} className="ml-4">
                    <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-sky-500 ring-4 ring-white" />
                    <div className="text-[10px] font-mono text-slate-400">{fmtDate(h.date)}</div>
                    <div className="text-xs font-bold text-slate-900">{h.event}: {h.title}</div>
                    <div className="text-[11px] text-slate-500">{h.department}{h.note ? ` • ${h.note}` : ''}</div>
                  </li>
                ))}
              </ol>
            ) : <div className="text-xs text-slate-400">No job history recorded yet. Changes to designation, department, salary or status are logged here automatically.</div>
          )}
          {detailTab === 'attendance' && selMonth && (
            <div className="space-y-3">
              <InfoGrid
                items={[
                  ['This month — present', `${selMonth.present} / ${selMonth.workingDays - selMonth.upcoming - selMonth.notEmployed} days`],
                  ['Late arrivals', selMonth.late],
                  ['Absent', selMonth.absent],
                  ['Overtime', fmtDuration(selMonth.overtimeMinutes)],
                ]}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {leaveBalances(sel.empId).map((b) => (
                  <div key={b.typeId} className="p-2.5 rounded-lg border border-slate-200 text-xs">
                    <div className="text-[10px] font-mono text-slate-400 uppercase truncate">{b.type}</div>
                    <div className="font-black text-slate-900">{b.unpaid ? `${b.used} used` : <>{b.available} <span className="text-slate-400 font-normal">/ {b.entitled}</span></>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}

      {form && (
        <Modal title={form.isNew ? 'Add new employee' : `Edit ${form.value.name}`} onClose={() => setForm(null)} width="max-w-2xl">
          <form onSubmit={submitForm} className="space-y-4">
            <EmployeeForm value={form.value} onChange={(value) => setForm({ ...form, value })} employees={employees} departments={departments} designations={designations} shifts={shifts} offices={offices} isNew={form.isNew} />
            {!form.isNew && (
              <Field label="Change note (job history / audit log)">
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} placeholder="e.g. Annual increment" />
              </Field>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Btn variant="outline" onClick={() => setForm(null)}>Cancel</Btn>
              <Btn variant="dark" type="submit" disabled={saving}><Icon name="save" /> {saving ? 'Saving…' : form.isNew ? 'Add employee' : 'Save changes'}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
};
