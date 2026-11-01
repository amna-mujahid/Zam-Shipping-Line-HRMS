import React, { useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { PERMISSIONS } from '@shared/permissions';
import { addDays, fmtDate, todayStr } from '@shared/dates';
import { Avatar, Btn, Card, EmptyRow, Field, Modal, Page, PageHeader, Pill, StatusBadge, Table, Tabs, inputCls } from '../common/ui';

export const AttendanceRequestsView = ({ onShowToast }) => {
  const { currentUser, regularizations, employeeByEmpId, dayFor, can, decideRegularization, submitRegularization } = useHrms();
  const approver = can(PERMISSIONS.REGULARIZE_APPROVE);
  const [tab, setTab] = useState('Pending');
  const [newReq, setNewReq] = useState(null);

  const scoped = approver ? regularizations : regularizations.filter((r) => r.empId === currentUser.empId);
  const list = scoped.filter((r) => tab === 'ALL' || r.status === tab);

  const decide = async (r, approve) => {
    const comment = approve ? '' : window.prompt('Reason for rejection (optional):') ?? null;
    if (comment === null) return;
    const res = await decideRegularization(r.id, approve, comment);
    if (res.ok) onShowToast(approve ? 'Correction approved' : 'Correction rejected', `${r.reqCode} • attendance ${approve ? 'updated' : 'unchanged'}.`, approve ? 'success' : 'info');
    else onShowToast('Action failed', res.error, 'error');
  };

  const openNew = () => {
    const yesterday = addDays(todayStr(), -1);
    const d = dayFor(currentUser, yesterday);
    setNewReq({ date: yesterday, inTime: d.inTime || d.shift.start, outTime: d.outTime || d.shift.end, reason: '' });
  };

  const submitNew = async (e) => {
    e.preventDefault();
    const res = await submitRegularization({ date: newReq.date, requestedIn: newReq.inTime, requestedOut: newReq.outTime, reason: newReq.reason });
    if (res.ok) {
      onShowToast('Correction submitted', `${res.reqCode} sent for approval.`);
      setNewReq(null);
    } else onShowToast('Not submitted', res.error, 'error');
  };

  const newDay = newReq ? dayFor(currentUser, newReq.date) : null;

  return (
    <Page>
      <PageHeader
        kicker="TIME & ATTENDANCE"
        icon="pending_actions"
        title={approver ? 'Attendance Corrections Queue' : 'My Attendance Corrections'}
        subtitle={approver ? 'Approve missed punches and late-arrival regularizations. Approved times flow straight into payroll.' : 'Request a fix for a missed or incorrect punch.'}
        actions={can(PERMISSIONS.REGULARIZE_REQUEST) && <Btn icon="add" onClick={openNew}>New request</Btn>}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={['Pending', 'Approved', 'Rejected', 'ALL'].map((t) => ({ id: t, label: `${t === 'ALL' ? 'All' : t} (${t === 'ALL' ? scoped.length : scoped.filter((r) => r.status === t).length})` }))}
      />

      <Card bodyClass="">
        <Table head={['Request', 'Employee', 'Date', 'Recorded', 'Requested', 'Reason', 'Status', ...(approver ? [{ label: 'Decision', className: 'text-right' }] : [])]} minWidth="min-w-[1000px]">
          {list.length === 0 && <EmptyRow cols={8} text="No requests in this view." />}
          {list.map((r) => {
            const emp = employeeByEmpId(r.empId);
            return (
              <tr key={r.id} className="hover:bg-slate-50 align-top">
                <td className="py-3 px-4">
                  <div className="font-mono font-bold text-sky-700">{r.reqCode}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Submitted {fmtDate(r.submittedAt)}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Avatar emp={emp} size="w-8 h-8" />
                    <div>
                      <div className="font-bold text-slate-900">{emp?.name}</div>
                      <div className="text-[10px] text-slate-500">{emp?.department}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="py-3 px-4 font-mono text-rose-700">{r.originalIn || '--:--'} → {r.originalOut || '--:--'}</td>
                <td className="py-3 px-4 font-mono text-emerald-700 font-bold">{r.requestedIn} → {r.requestedOut}</td>
                <td className="py-3 px-4 text-slate-600 max-w-[260px]">
                  {r.reason}
                  {r.comment && <div className="text-[10px] text-slate-400 mt-1">Reviewer: {r.comment}</div>}
                </td>
                <td className="py-3 px-4">
                  <Pill value={r.status} />
                  {r.decidedBy && <div className="text-[10px] text-slate-400 mt-1">by {r.decidedBy}</div>}
                </td>
                {approver && (
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {r.status === 'Pending' && r.empId !== currentUser.empId && (
                      <div className="inline-flex gap-1.5">
                        <Btn variant="success" icon="check" className="px-2.5 py-1" onClick={() => decide(r, true)}>Approve</Btn>
                        <Btn variant="outline" icon="close" className="px-2.5 py-1" onClick={() => decide(r, false)}>Reject</Btn>
                      </div>
                    )}
                    {r.status === 'Pending' && r.empId === currentUser.empId && <span className="text-[10px] text-slate-400">Own request</span>}
                  </td>
                )}
              </tr>
            );
          })}
        </Table>
      </Card>

      {newReq && (
        <Modal title="Request attendance correction" onClose={() => setNewReq(null)}>
          <form onSubmit={submitNew} className="space-y-3">
            <Field label="Date">
              <input
                type="date" required max={todayStr()} value={newReq.date}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const d = dayFor(currentUser, e.target.value);
                  setNewReq({ ...newReq, date: e.target.value, inTime: d.inTime || d.shift.start, outTime: d.outTime || d.shift.end });
                }}
                className={inputCls}
              />
            </Field>
            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              Currently recorded: <StatusBadge status={newDay.status} /> <span className="font-mono">{newDay.inTime || '--:--'} → {newDay.outTime || '--:--'}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Correct check-in"><input type="time" required value={newReq.inTime} onChange={(e) => setNewReq({ ...newReq, inTime: e.target.value })} className={inputCls} /></Field>
              <Field label="Correct check-out"><input type="time" required value={newReq.outTime} onChange={(e) => setNewReq({ ...newReq, outTime: e.target.value })} className={inputCls} /></Field>
            </div>
            <Field label="Reason">
              <textarea required rows={3} value={newReq.reason} onChange={(e) => setNewReq({ ...newReq, reason: e.target.value })} className={inputCls} />
            </Field>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <Btn variant="outline" onClick={() => setNewReq(null)}>Cancel</Btn>
              <Btn variant="dark" type="submit">Submit</Btn>
            </div>
          </form>
        </Modal>
      )}
    </Page>
  );
};
