import React, { useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { PERMISSIONS } from '@shared/permissions';
import { addDays, fmtDate, todayStr } from '@shared/dates';
import { Avatar, Btn, Card, EmptyRow, Field, Modal, Page, PageHeader, Pill, Table, Tabs, inputCls } from '../common/ui';

export const LeaveManagementView = ({ onShowToast }) => {
  const { currentUser, employees, leaves, leaveTypes, can, employeeByEmpId, leaveBalances, countLeaveDays, submitLeave, decideLeave, managerDecideLeave, cancelLeave } = useHrms();
  const isAdmin = can(PERMISSIONS.LEAVE_ALL); // HR: final approval
  const isTeam = !isAdmin && can(PERMISSIONS.LEAVE_TEAM); // Department head: first approval for direct reports
  const showEmployee = isAdmin || isTeam;
  const [tab, setTab] = useState('Pending');
  const [apply, setApply] = useState(null);

  const scoped = isAdmin ? leaves : isTeam ? leaves.filter((l) => !l.minimal) : leaves.filter((l) => l.empId === currentUser.empId);
  const list = scoped.filter((l) => tab === 'ALL' || l.status === tab).sort((a, b) => b.fromDate.localeCompare(a.fromDate));

  const decide = async (l, approve) => {
    const comment = approve ? '' : window.prompt('Reason for rejection (optional):') ?? null;
    if (comment === null) return;
    const res = isAdmin ? await decideLeave(l.id, approve, comment) : await managerDecideLeave(l.id, approve, comment);
    const who = employeeByEmpId(l.empId)?.name;
    if (!res.ok) onShowToast('Action failed', res.error, 'error');
    else if (!isAdmin) onShowToast(approve ? 'Recommended for approval' : 'Rejected at department level', `${l.reqCode} • ${who} — sent to HR for the final decision.`, approve ? 'success' : 'info');
    else onShowToast(approve ? 'Leave approved' : 'Leave rejected', `${l.reqCode} • ${who}${approve ? ` — ${res.leaveDays} day(s) marked On Leave in attendance` : ''}`, approve ? 'success' : 'info');
  };

  const submit = async (e) => {
    e.preventDefault();
    const res = await submitLeave({ ...apply, leaveTypeId: Number(apply.leaveTypeId) });
    if (res.ok) {
      const typeName = leaveTypes.find((t) => t.id === Number(apply.leaveTypeId))?.name || 'leave';
      onShowToast('Leave requested', `${res.reqCode}: ${res.days} working day(s) of ${typeName} sent for approval.`);
      setApply(null);
    } else onShowToast('Not submitted', res.error, 'error');
  };

  const myBalances = leaveBalances(currentUser.empId);
  const applyDays = apply && apply.toDate >= apply.fromDate ? countLeaveDays(apply.fromDate, apply.toDate) : 0;

  return (
    <Page>
      <PageHeader
        kicker="LEAVE"
        icon="event_available"
        title={isAdmin ? 'Leave Management' : isTeam ? 'Team Leave Approvals' : 'My Leave'}
        subtitle={isAdmin
          ? 'HR gives the final approval. Approved days are written to attendance as On Leave; unpaid leave becomes loss of pay in payroll.'
          : isTeam
            ? 'First-level approval for employees who report to you. HR gives the final approval.'
            : 'Check balances, apply for time off and track your requests. Requests go to your department head (if any) and then HR.'}
        actions={can(PERMISSIONS.LEAVE_SELF) && !isAdmin && (
          <Btn icon="add" disabled={!leaveTypes.length} onClick={() => setApply({ leaveTypeId: leaveTypes[0]?.id, fromDate: addDays(todayStr(), 7), toDate: addDays(todayStr(), 7), reason: '' })}>Apply for leave</Btn>
        )}
      />

      {!showEmployee && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {myBalances.length === 0 && <div className="text-xs text-slate-400">No leave types are set up in the leave_type table yet.</div>}
          {myBalances.map((b) => (
            <div key={b.typeId} className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
              <div className="text-xs font-mono font-bold text-sky-700 uppercase">{b.type}</div>
              {b.unpaid ? (
                <div className="text-3xl font-black text-slate-900 mt-2 font-tabular-data">{b.used} <span className="text-sm text-slate-400 font-normal">days taken</span></div>
              ) : (
                <div className="text-3xl font-black text-slate-900 mt-2 font-tabular-data">{b.available} <span className="text-sm text-slate-400 font-normal">/ {b.entitled} days</span></div>
              )}
              <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden flex">
                <div className="bg-sky-600 h-full" style={{ width: `${b.entitled ? Math.min(100, (b.used / b.entitled) * 100) : 0}%` }} />
                <div className="bg-amber-400 h-full" style={{ width: `${b.entitled ? Math.min(100, (b.pending / b.entitled) * 100) : 0}%` }} />
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">
                {b.used} used • {b.pending} pending • {b.grantMethod}
                {b.entitled === 0 && !b.unpaid && currentUser.status === 'Probation' ? ' • available after confirmation' : ''}
                {b.unpaid ? ' • deducted from salary' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={['Pending', 'Approved', 'Rejected', 'ALL'].map((t) => ({ id: t, label: `${t === 'ALL' ? 'All' : t} (${t === 'ALL' ? scoped.length : scoped.filter((l) => l.status === t).length})` }))}
      />

      <Card bodyClass="">
        <Table head={['Request', ...(showEmployee ? ['Employee'] : []), 'Type', 'Dates', 'Days', 'Reason', 'Dept head', 'HR (final)', { label: '', className: 'text-right' }]} minWidth="min-w-[1000px]">
          {list.length === 0 && <EmptyRow cols={9} text="No leave requests in this view." />}
          {list.map((l) => {
            const emp = employeeByEmpId(l.empId);
            return (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="py-3 px-4">
                  <div className="font-mono font-bold text-sky-700">{l.reqCode}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Submitted {fmtDate(l.submittedAt)}</div>
                </td>
                {showEmployee && (
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Avatar emp={emp} size="w-8 h-8" />
                      <div>
                        <div className="font-bold text-slate-900">{emp?.name}</div>
                        <div className="text-[10px] text-slate-500">{emp?.department}</div>
                      </div>
                    </div>
                  </td>
                )}
                <td className="py-3 px-4 font-semibold">{l.leaveType}</td>
                <td className="py-3 px-4 font-mono whitespace-nowrap">{fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? ` → ${fmtDate(l.toDate)}` : ''}</td>
                <td className="py-3 px-4 font-mono font-bold">{countLeaveDays(l.fromDate, l.toDate)}</td>
                <td className="py-3 px-4 text-slate-600 max-w-[240px]">
                  {l.reason}
                  {l.comment && <div className="text-[10px] text-slate-400 mt-1">Reviewer: {l.comment}</div>}
                </td>
                <td className="py-3 px-4">
                  {l.managerStatus === 'Not required' ? (
                    <span className="text-[10px] text-slate-400">Not required</span>
                  ) : (
                    <>
                      <Pill value={l.managerStatus} />
                      {l.managerBy && <div className="text-[10px] text-slate-400 mt-1">by {l.managerBy}</div>}
                    </>
                  )}
                </td>
                <td className="py-3 px-4">
                  <Pill value={l.status} />
                  {l.decidedBy && <div className="text-[10px] text-slate-400 mt-1">by {l.decidedBy}</div>}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {isAdmin && l.status === 'Pending' && l.empId !== currentUser.empId && (
                    <div className="inline-flex gap-1.5 items-center">
                      {l.managerStatus === 'Pending' && <span className="text-[10px] text-amber-600 mr-1">Dept head pending</span>}
                      <Btn variant="success" icon="check" className="px-2.5 py-1" onClick={() => decide(l, true)}>Approve</Btn>
                      <Btn variant="outline" icon="close" className="px-2.5 py-1" onClick={() => decide(l, false)}>Reject</Btn>
                    </div>
                  )}
                  {isTeam && l.status === 'Pending' && l.managerStatus === 'Pending' && (
                    <div className="inline-flex gap-1.5">
                      <Btn variant="success" icon="check" className="px-2.5 py-1" onClick={() => decide(l, true)}>Approve</Btn>
                      <Btn variant="outline" icon="close" className="px-2.5 py-1" onClick={() => decide(l, false)}>Reject</Btn>
                    </div>
                  )}
                  {!showEmployee && l.status === 'Pending' && (
                    <Btn variant="outline" className="px-2.5 py-1" onClick={async () => { const r = await cancelLeave(l.id); if (r.ok) onShowToast('Request cancelled', l.reqCode, 'info'); else onShowToast('Not cancelled', r.error, 'error'); }}>Cancel</Btn>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {isAdmin && (
        <Card title="Leave balances — all employees" subtitle={`Calendar year ${todayStr().slice(0, 4)} • available / entitled (pending)`} bodyClass="">
          <Table head={['Employee', ...leaveTypes.map((t) => t.name)]} minWidth="min-w-[700px]">
            {employees.filter((e) => e.active !== false).map((e) => (
              <tr key={e.empId} className="hover:bg-slate-50">
                <td className="py-2.5 px-4 font-bold text-slate-900">{e.name} <span className="text-[10px] text-slate-400 font-normal">{e.status === 'Probation' ? 'probation' : ''}</span></td>
                {leaveBalances(e.empId).map((b) => (
                  <td key={b.typeId} className="py-2.5 px-4 font-mono">
                    {b.unpaid ? <>{b.used} taken</> : <><span className="font-bold">{b.available}</span> / {b.entitled}</>}
                    {b.pending ? <span className="text-amber-600"> ({b.pending})</span> : ''}
                  </td>
                ))}
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {apply && (
        <Modal title="Apply for leave" onClose={() => setApply(null)}>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Leave type">
              <select value={apply.leaveTypeId} onChange={(e) => setApply({ ...apply, leaveTypeId: Number(e.target.value) })} className={inputCls}>
                {leaveTypes.map((t) => {
                  const b = myBalances.find((x) => x.typeId === t.id);
                  return <option key={t.id} value={t.id}>{t.name}{b?.unpaid ? ' (deducted from salary)' : b ? ` (${b.available} available)` : ''}</option>;
                })}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><input type="date" required value={apply.fromDate} onChange={(e) => setApply({ ...apply, fromDate: e.target.value, toDate: apply.toDate < e.target.value ? e.target.value : apply.toDate })} className={inputCls} /></Field>
              <Field label="To"><input type="date" required min={apply.fromDate} value={apply.toDate} onChange={(e) => setApply({ ...apply, toDate: e.target.value })} className={inputCls} /></Field>
            </div>
            <div className="text-xs text-slate-600">Working days requested: <strong>{applyDays}</strong> <span className="text-slate-400">(weekends & holidays excluded)</span></div>
            <Field label="Reason"><textarea required rows={3} value={apply.reason} onChange={(e) => setApply({ ...apply, reason: e.target.value })} className={inputCls} /></Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Btn variant="outline" onClick={() => setApply(null)}>Cancel</Btn>
              <Btn variant="dark" type="submit">Submit request</Btn>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
};
