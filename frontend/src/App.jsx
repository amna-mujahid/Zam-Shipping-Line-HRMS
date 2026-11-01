import React, { useEffect, useState } from 'react';
import { HrmsProvider, useHrms } from './context/HrmsContext';
import { DEFAULT_VIEW, canAccessView } from '@shared/permissions';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Toast } from './components/common/Toast';
import { AccessDenied } from './components/common/ui';

import { LoginView } from './components/views/LoginView';
import { OwnerDashboardView } from './components/views/OwnerDashboardView';
import { EmployeePortalView } from './components/views/EmployeePortalView';
import { TimeClockView } from './components/views/TimeClockView';
import { AttendanceView } from './components/views/AttendanceView';
import { EmployeeMonthlyAttendanceView } from './components/views/EmployeeMonthlyAttendanceView';
import { AttendanceRequestsView } from './components/views/AttendanceRequestsView';
import { SchedulesDesignationsView } from './components/views/SchedulesDesignationsView';
import { EmployeesView } from './components/views/EmployeesView';
import { OrgChartView } from './components/views/OrgChartView';
import { AccessControlView } from './components/views/AccessControlView';
import { PayrollView } from './components/views/PayrollView';
import { MyPayslipsView } from './components/views/MyPayslipsView';
import { LeaveManagementView } from './components/views/LeaveManagementView';
import { CalendarHolidaysView } from './components/views/CalendarHolidaysView';
import { MyProfileView } from './components/views/MyProfileView';
import { PoliciesView } from './components/views/PoliciesView';
import { ReportsAnalyticsView } from './components/views/ReportsAnalyticsView';
import { AuditLogView } from './components/views/AuditLogView';

const VIEW_COMPONENTS = {
  dashboard: OwnerDashboardView,
  'ess-home': EmployeePortalView,
  'time-clock': TimeClockView,
  attendance: AttendanceView,
  'monthly-attendance': EmployeeMonthlyAttendanceView,
  regularization: AttendanceRequestsView,
  shifts: SchedulesDesignationsView,
  employees: EmployeesView,
  'org-chart': OrgChartView,
  'access-control': AccessControlView,
  payroll: PayrollView,
  'my-payslips': MyPayslipsView,
  leave: LeaveManagementView,
  holidays: CalendarHolidaysView,
  'my-profile': MyProfileView,
  policies: PoliciesView,
  reports: ReportsAnalyticsView,
  'audit-log': AuditLogView,
};

const FullScreen = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs max-w-md w-full text-center space-y-3">{children}</div>
  </div>
);

const Shell = () => {
  const { currentUser, role, status, loadError, refresh, logout } = useHrms();
  const [activeView, setActiveView] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, title: '', message: '', type: 'success' });

  const showToast = (title, message, type = 'success') => setToast({ show: true, title, message, type });

  useEffect(() => {
    if (!toast.show) return undefined;
    const t = setTimeout(() => setToast((p) => ({ ...p, show: false })), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Land on the role's home view after sign-in, or when a role change revokes access.
  useEffect(() => {
    if (role && (!activeView || !canAccessView(role, activeView))) setActiveView(DEFAULT_VIEW[role]);
    if (!role) setActiveView(null);
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const toastEl = (
    <Toast show={toast.show} title={toast.title} message={toast.message} type={toast.type} onClose={() => setToast((p) => ({ ...p, show: false }))} />
  );

  if (status === 'loading') {
    return (
      <FullScreen>
        <span className="material-symbols-outlined text-[32px] text-sky-600 animate-spin">progress_activity</span>
        <div className="text-sm font-bold text-slate-800">Loading HR data…</div>
      </FullScreen>
    );
  }

  if (status === 'error') {
    return (
      <FullScreen>
        <span className="material-symbols-outlined text-[32px] text-rose-600">cloud_off</span>
        <div className="text-sm font-bold text-slate-900">Could not load data</div>
        <p className="text-xs text-slate-600">{loadError}</p>
        <div className="flex justify-center gap-2 pt-2">
          <button type="button" onClick={refresh} className="px-4 py-2 rounded-lg bg-[#0a2540] text-white text-xs font-bold">Retry</button>
          <button type="button" onClick={logout} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold">Sign out</button>
        </div>
      </FullScreen>
    );
  }

  if (!currentUser) {
    return (
      <>
        {toastEl}
        <LoginView onLoggedIn={(u) => showToast('Signed in', `Welcome, ${u.name}.`)} />
      </>
    );
  }

  const view = activeView || DEFAULT_VIEW[role];
  const allowed = canAccessView(role, view);
  const View = VIEW_COMPONENTS[view];

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 antialiased font-sans">
      {toastEl}
      <Sidebar
        activeView={view}
        onSelectView={setActiveView}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <Header onSelectView={setActiveView} onOpenMobileSidebar={() => setIsMobileMenuOpen(true)} />
        <main className="flex-1 w-full overflow-y-auto">
          {allowed && View ? <View key={view} onSelectView={setActiveView} onShowToast={showToast} /> : <AccessDenied />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <HrmsProvider>
      <Shell />
    </HrmsProvider>
  );
}
