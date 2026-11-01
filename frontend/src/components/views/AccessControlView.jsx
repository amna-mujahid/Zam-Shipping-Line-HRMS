import React from 'react';
import { useHrms } from '../../context/HrmsContext';
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS } from '@shared/permissions';
import { ROLES } from '@shared/roles';
import { Avatar, Btn, Card, Icon, Page, PageHeader, Table, inputCls } from '../common/ui';

const ROLE_DB_LABELS = { [ROLES.OWNER]: 'HR (Owner)', [ROLES.MANAGER]: 'Department Head', [ROLES.EMPLOYEE]: 'Employee' };

const PERMISSION_LABELS = {
  [PERMISSIONS.EMPLOYEE_DIRECTORY]: 'Employee directory — view & edit all personnel records',
  [PERMISSIONS.ORG_CHART]: 'Organization chart',
  [PERMISSIONS.ACCESS_CONTROL]: 'Manage user roles & accounts',
  [PERMISSIONS.ATTENDANCE_ALL]: 'View attendance of all employees',
  [PERMISSIONS.ATTENDANCE_SELF]: 'View own attendance',
  [PERMISSIONS.ATTENDANCE_EDIT]: 'Manual attendance entries & overrides',
  [PERMISSIONS.REGULARIZE_APPROVE]: 'Approve attendance corrections',
  [PERMISSIONS.REGULARIZE_REQUEST]: 'Request attendance corrections',
  [PERMISSIONS.TIME_CLOCK]: 'Time clock (check-in / out / breaks)',
  [PERMISSIONS.SHIFTS]: 'Shifts & designations',
  [PERMISSIONS.LEAVE_ALL]: 'Final leave approval for all employees (HR)',
  [PERMISSIONS.LEAVE_TEAM]: 'First-level leave approval for direct reports',
  [PERMISSIONS.LEAVE_SELF]: 'Apply for own leave',
  [PERMISSIONS.PAYROLL_RUN]: 'Run & finalize payroll, salary data',
  [PERMISSIONS.PAYSLIP_SELF]: 'View own payslips',
  [PERMISSIONS.PROFILE_SELF]: 'Update own personal information',
  [PERMISSIONS.POLICIES]: 'Read company policies',
  [PERMISSIONS.HOLIDAYS]: 'Company holiday calendar',
  [PERMISSIONS.REPORTS]: 'Reports, analytics & dashboards',
  [PERMISSIONS.AUDIT_LOG]: 'Audit trail',
};

export const AccessControlView = ({ onShowToast }) => {
  const { employees, currentUser, setEmployeeRole, setEmployeeActive, resetPassword } = useHrms();

  const report = async (promise, title, msg) => {
    const res = await promise;
    if (res.ok) onShowToast(title, typeof msg === 'function' ? msg(res) : msg);
    else onShowToast('Not saved', res.error, 'error');
  };

  return (
    <Page>
      <PageHeader
        kicker="PEOPLE"
        icon="admin_panel_settings"
        title="Roles & Access Control"
        subtitle="HR (Owner): full access • Department Head (Manager): attendance + first-level leave approval for their team • Employee: own records only. Login accounts live in the users table; every change is written to audit_log."
      />

      <Card title="User accounts" bodyClass="">
        <Table head={['User', 'Department', 'Access role', 'Account', { label: 'Actions', className: 'text-right' }]} minWidth="min-w-[800px]">
          {employees.map((e) => {
            const self = e.empId === currentUser.empId;
            return (
              <tr key={e.empId} className={`hover:bg-slate-50 ${e.active === false ? 'opacity-60' : ''}`}>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Avatar emp={e} size="w-8 h-8" />
                    <div>
                      <div className="font-bold text-slate-900">{e.name} {self && <span className="text-[10px] text-sky-600">(you)</span>}</div>
                      <div className="text-[11px] font-mono text-slate-500">{e.hasAccount ? `username: ${e.username}` : 'no login account'}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-600">{e.department}</td>
                <td className="py-3 px-4">
                  <select
                    disabled={self || !e.hasAccount}
                    value={e.role}
                    onChange={(ev) => report(setEmployeeRole(e.empId, ev.target.value), 'Role updated', `${e.name} is now ${ROLE_LABELS[ev.target.value]}.`)}
                    className={`${inputCls} w-40`}
                  >
                    {Object.values(ROLES).map((r) => <option key={r} value={r}>{ROLE_DB_LABELS[r]}</option>)}
                  </select>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${e.accountActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {!e.hasAccount ? 'NO LOGIN' : e.accountActive ? 'ACTIVE' : 'DEACTIVATED'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {!self && (
                    <div className="inline-flex gap-1.5">
                      <Btn
                        variant="outline"
                        icon="key"
                        className="px-2.5 py-1"
                        onClick={() => {
                          const pw = window.prompt(e.hasAccount ? `New password for ${e.name}:` : `Create a login for ${e.name}.
Username will be ${e.empId}. Enter a password:`);
                          if (pw) report(resetPassword(e.empId, pw), e.hasAccount ? 'Password reset' : 'Login created', (r) => (r.created ? `${e.name} can sign in as ${r.username}.` : `${e.name} can now sign in with the new password.`));
                        }}
                      >
                        {e.hasAccount ? 'Reset password' : 'Create login'}
                      </Btn>
                      {e.hasAccount && (
                        <Btn
                          variant={e.accountActive ? 'outline' : 'success'}
                          icon={e.accountActive ? 'block' : 'check'}
                          className="px-2.5 py-1"
                          onClick={() => report(setEmployeeActive(e.empId, !e.accountActive), e.accountActive ? 'Account deactivated' : 'Account activated', e.name)}
                        >
                          {e.accountActive ? 'Deactivate' : 'Activate'}
                        </Btn>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title="Permission matrix" subtitle="What each role can do. Enforced on every action, not only hidden in navigation." bodyClass="">
        <Table head={['Permission', ...Object.values(ROLES).map((r) => ({ label: ROLE_DB_LABELS[r], className: 'text-center' }))]} minWidth="min-w-[640px]">
          {Object.values(PERMISSIONS).map((p) => (
            <tr key={p} className="hover:bg-slate-50">
              <td className="py-2.5 px-4 text-slate-800">{PERMISSION_LABELS[p]}</td>
              {Object.values(ROLES).map((r) => (
                <td key={r} className="py-2.5 px-4 text-center">
                  {ROLE_PERMISSIONS[r].includes(p)
                    ? <Icon name="check_circle" className="text-[18px] text-emerald-600" />
                    : <Icon name="remove" className="text-[18px] text-slate-300" />}
                </td>
              ))}
            </tr>
          ))}
        </Table>
      </Card>
    </Page>
  );
};
