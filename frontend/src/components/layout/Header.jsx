import React, { useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { PERMISSIONS, ROLE_LABELS } from '@shared/permissions';
import { fmtDate, monthKeyOf, monthLabel, periodRangeLabel, todayStr } from '@shared/dates';
import { Avatar } from '../common/ui';

export const Header = ({ onSelectView, onOpenMobileSidebar }) => {
  const { currentUser, role, can, regularizations, leaves, payrollRuns, employeeByEmpId, logout } = useHrms();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const today = todayStr();
  const nameOf = (empId) => employeeByEmpId(empId)?.name || empId;

  // Notifications are derived from live data and scoped to what the role may see.
  const notifications = [];
  if (can(PERMISSIONS.REGULARIZE_APPROVE)) {
    regularizations.filter((r) => r.status === 'Pending').forEach((r) =>
      notifications.push({ id: r.id, title: `Attendance correction from ${nameOf(r.empId)} for ${fmtDate(r.date)}`, view: 'regularization' })
    );
  }
  if (can(PERMISSIONS.LEAVE_ALL)) {
    leaves.filter((l) => l.status === 'Pending').forEach((l) =>
      notifications.push({ id: l.id, title: `${l.leaveType} request from ${nameOf(l.empId)}`, view: 'leave' })
    );
  }
  if (can(PERMISSIONS.LEAVE_TEAM) && !can(PERMISSIONS.LEAVE_ALL)) {
    leaves.filter((l) => !l.minimal && l.status === 'Pending' && l.managerStatus === 'Pending').forEach((l) =>
      notifications.push({ id: `t-${l.id}`, title: `${l.leaveType} request from ${nameOf(l.empId)} needs your approval`, view: 'leave' })
    );
  }
  if (!can(PERMISSIONS.ATTENDANCE_ALL)) {
    leaves.filter((l) => l.empId === currentUser.empId && l.status !== 'Pending' && l.status !== 'Cancelled').slice(0, 3).forEach((l) =>
      notifications.push({ id: l.id, title: `Your ${l.leaveType} (${fmtDate(l.fromDate)}) was ${l.status.toLowerCase()}`, view: 'leave' })
    );
    regularizations.filter((r) => r.empId === currentUser.empId && r.status !== 'Pending').slice(0, 3).forEach((r) =>
      notifications.push({ id: r.id, title: `Correction ${r.reqCode} was ${r.status.toLowerCase()}`, view: 'regularization' })
    );
    if (can(PERMISSIONS.PAYSLIP_SELF)) {
      Object.keys(payrollRuns).sort().reverse().slice(0, 1).forEach((m) =>
        notifications.push({ id: `pay-${m}`, title: `Payslip for ${monthLabel(m)} is available`, view: 'my-payslips' })
      );
    }
  }

  return (
    <header className="sticky top-0 z-20 w-full h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-xs">
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          onClick={onOpenMobileSidebar}
          type="button"
          aria-label="Open sidebar menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>
        <div className="flex items-center gap-2 text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold">
          <span className="material-symbols-outlined text-[16px] text-sky-600">calendar_today</span>
          <span className="font-mono text-slate-900 truncate">
            {fmtDate(today)} <span className="hidden sm:inline text-slate-500">• Pay period {monthLabel(monthKeyOf(today))} ({periodRangeLabel(monthKeyOf(today))})</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            type="button"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 relative"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-[20px]">notifications</span>
            {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">Notifications</span>
                <span className="text-[10px] font-mono font-bold bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded">{notifications.length}</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.length === 0 && <div className="p-4 text-xs text-slate-400 text-center">You're all caught up.</div>}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { onSelectView(n.view); setNotifOpen(false); }}
                    className="w-full text-left p-3 hover:bg-slate-50 text-xs font-semibold text-slate-800"
                  >
                    {n.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            type="button"
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Avatar emp={currentUser} size="w-8 h-8" />
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight">{currentUser.name}</span>
              <span className="text-[10px] font-mono text-slate-500">{ROLE_LABELS[role]}</span>
            </div>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-1 text-xs">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <div className="font-bold text-slate-900">{currentUser.name}</div>
                <div className="text-[11px] text-slate-500">{currentUser.designation}</div>
                <div className="text-[10px] font-mono text-sky-600 mt-0.5">{currentUser.email}</div>
              </div>
              <div className="p-1">
                {can(PERMISSIONS.PROFILE_SELF) && (
                  <button type="button" onClick={() => { onSelectView('my-profile'); setProfileOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-sky-600">person</span> My Profile
                  </button>
                )}
                <button type="button" onClick={logout} className="w-full text-left px-3 py-2 rounded-lg text-rose-700 hover:bg-rose-50 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">logout</span> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
