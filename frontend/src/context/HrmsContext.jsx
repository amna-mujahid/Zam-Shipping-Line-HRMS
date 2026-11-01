// Central client store. Data lives in MySQL (zam_hrms); the server returns only what the
// signed-in role may see. Every action is sent to the server, which checks permissions,
// writes the database and the audit log; the store then reloads.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../lib/api';
import { hasPermission } from '@shared/permissions';
import { computeDay } from '@shared/attendance';
import { countWorkingDays, leaveBalancesFor } from '@shared/leave';
import { computePayrollRun } from '@shared/payroll';
import { recordKey } from '@shared/attendance';
import { todayStr } from '@shared/dates';
import { OFFICES } from '../config/offices';
import { POLICIES } from '../data/policies';

const HrmsContext = createContext(null);

const EMPTY = {
  employees: [], records: {}, leaves: [], regularizations: [], holidays: [], shifts: [],
  departments: [], designations: [], leaveTypes: [], roles: [], payrollRuns: {}, payrollSettings: null,
  policyAcks: {}, auditLogs: [], calendar: { from: null, to: null, offDays: [] }, me: null,
};

const ACTIONS = [
  'addEmployee', 'updateEmployee', 'setEmployeeRole', 'setEmployeeActive', 'resetPassword', 'updateOwnProfile',
  'clockIn', 'clockOut', 'toggleBreak', 'saveAttendance', 'markAttendance',
  'submitRegularization', 'decideRegularization',
  'submitLeave', 'decideLeave', 'managerDecideLeave', 'cancelLeave',
  'addHoliday', 'removeHoliday',
  'addDepartment', 'addDesignation', 'setDesignationSchedule', 'saveSchedule',
  'finalizePayroll', 'reopenPayroll', 'updatePayrollSettings',
  'acknowledgePolicy',
];

// `initialState` pre-loads server state (used for rendering screens in tests).
export const HrmsProvider = ({ children, initialState = null }) => {
  const [state, setState] = useState(initialState ? { ...EMPTY, ...initialState } : EMPTY);
  // 'loading' | 'anon' | 'ready' | 'error'
  const [status, setStatus] = useState(initialState ? 'ready' : getToken() ? 'loading' : 'anon');
  const [loadError, setLoadError] = useState('');

  const refresh = useCallback(async () => {
    const res = await api.state();
    if (res.ok) {
      setState({ ...EMPTY, ...res.state });
      setStatus('ready');
      return res;
    }
    if (res.unauthorized) {
      setToken(null);
      setState(EMPTY);
      setStatus('anon');
    } else {
      setLoadError(res.error);
      setStatus('error');
    }
    return res;
  }, []);

  useEffect(() => {
    if (getToken()) refresh();
  }, [refresh]);

  const login = async (username, password) => {
    const res = await api.login(username, password);
    if (!res.ok) return res;
    setToken(res.token);
    setStatus('loading');
    const loaded = await refresh();
    return loaded.ok ? res : loaded;
  };

  const logout = () => {
    setToken(null);
    setState(EMPTY);
    setStatus('anon');
  };

  // Each action: POST to the server, then reload state on success.
  const actions = useMemo(
    () =>
      Object.fromEntries(
        ACTIONS.map((name) => [
          name,
          async (...args) => {
            const res = await api.action(name, args);
            if (res.unauthorized) logout();
            else if (res.ok) await refresh();
            return res;
          },
        ])
      ),
    [refresh] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const role = state.me?.role || null;
  const currentUser = useMemo(() => {
    if (!state.me) return null;
    const emp = state.employees.find((e) => e.empId === state.me.empId);
    return emp ? { ...emp, role: state.me.role } : null;
  }, [state.me, state.employees]);
  const can = useCallback((perm) => !!role && hasPermission(role, perm), [role]);

  const calendarCtx = useMemo(
    () => ({ from: state.calendar.from, to: state.calendar.to, offDays: new Set(state.calendar.offDays) }),
    [state.calendar]
  );
  const attendanceCtx = useMemo(
    () => ({ records: state.records, leaves: state.leaves, holidays: state.holidays, shifts: state.shifts, calendar: calendarCtx }),
    [state.records, state.leaves, state.holidays, state.shifts, calendarCtx]
  );

  const employeeByEmpId = useCallback((empId) => state.employees.find((e) => e.empId === String(empId)), [state.employees]);
  const dayFor = useCallback((emp, date) => computeDay(emp, date, attendanceCtx), [attendanceCtx]);
  const todayRecord = useCallback((empId) => state.records[recordKey(empId, todayStr())] || null, [state.records]);

  const countLeaveDays = useCallback((from, to) => countWorkingDays(from, to, attendanceCtx), [attendanceCtx]);
  const leaveBalances = useCallback(
    (empId, year = todayStr().slice(0, 4)) => {
      const emp = employeeByEmpId(empId);
      return emp ? leaveBalancesFor(emp, state.leaves, state.leaveTypes, attendanceCtx, year, todayStr()) : [];
    },
    [employeeByEmpId, state.leaves, state.leaveTypes, attendanceCtx]
  );

  const computeDraftRun = useCallback(
    (monthKey) => computePayrollRun(state.employees, monthKey, attendanceCtx, state.payrollSettings || {}),
    [state.employees, attendanceCtx, state.payrollSettings]
  );

  const value = {
    ...state,
    status,
    loadError,
    refresh,
    offices: OFFICES,
    policies: POLICIES,
    currentUser,
    role,
    can,
    attendanceCtx,
    employeeByEmpId,
    dayFor,
    todayRecord,
    leaveBalances,
    countLeaveDays,
    computeDraftRun,
    login,
    logout,
    ...actions,
  };

  return <HrmsContext.Provider value={value}>{children}</HrmsContext.Provider>;
};

export const useHrms = () => {
  const ctx = useContext(HrmsContext);
  if (!ctx) throw new Error('useHrms must be used inside <HrmsProvider>');
  return ctx;
};
