import React, { useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { Avatar, Card, Icon, Page, PageHeader, StatCard } from '../common/ui';

const Node = ({ emp, reportsOf, depth, collapsed, toggle }) => {
  const reports = reportsOf(emp.empId);
  const isCollapsed = collapsed.has(emp.empId);
  return (
    <li className="relative">
      <div className={`flex items-center gap-3 p-3 rounded-xl border bg-white shadow-xs ${depth === 0 ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200'}`}>
        <Avatar emp={emp} size="w-10 h-10" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-slate-900 truncate">{emp.name}</div>
          <div className="text-[11px] text-slate-500 truncate">{emp.designation}</div>
          <div className="text-[10px] font-mono text-sky-700">{emp.department}</div>
        </div>
        {reports.length > 0 && (
          <button
            type="button"
            onClick={() => toggle(emp.empId)}
            className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center gap-1"
          >
            {reports.length} report{reports.length > 1 ? 's' : ''}
            <Icon name={isCollapsed ? 'expand_more' : 'expand_less'} className="text-[14px]" />
          </button>
        )}
      </div>
      {reports.length > 0 && !isCollapsed && (
        <ul className="mt-2 ml-5 pl-5 border-l-2 border-slate-200 space-y-2">
          {reports.map((r) => (
            <Node key={r.empId} emp={r} reportsOf={reportsOf} depth={depth + 1} collapsed={collapsed} toggle={toggle} />
          ))}
        </ul>
      )}
    </li>
  );
};

export const OrgChartView = () => {
  const { employees } = useHrms();
  const [collapsed, setCollapsed] = useState(new Set());
  const active = employees.filter((e) => e.active !== false);
  const ids = new Set(active.map((e) => e.empId));
  const reportsOf = (empId) => active.filter((e) => e.managerId === empId);
  // Roots: no manager, or manager no longer active.
  const roots = active.filter((e) => !e.managerId || !ids.has(e.managerId));

  const toggle = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const depthOf = (e, seen = new Set()) => (!e.managerId || !ids.has(e.managerId) || seen.has(e.empId) ? 1 : 1 + depthOf(active.find((x) => x.empId === e.managerId), new Set([...seen, e.empId])));
  const managers = active.filter((e) => reportsOf(e.empId).length > 0);
  const byDept = active.reduce((m, e) => ({ ...m, [e.department]: (m[e.department] || 0) + 1 }), {});

  return (
    <Page>
      <PageHeader kicker="PEOPLE" icon="account_tree" title="Organization Chart" subtitle="Reporting lines are maintained from each employee's “Reports to” field in the directory." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Headcount" value={active.length} icon="groups" />
        <StatCard label="People managers" value={managers.length} icon="supervisor_account" tone="emerald" />
        <StatCard label="Org depth" value={`${Math.max(...active.map((e) => depthOf(e)))} levels`} icon="stacked_bar_chart" tone="purple" />
        <StatCard label="Avg span of control" value={(managers.reduce((a, m) => a + reportsOf(m.empId).length, 0) / Math.max(1, managers.length)).toFixed(1)} icon="hub" tone="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Reporting hierarchy" className="lg:col-span-2">
          <ul className="space-y-2">
            {roots.map((r) => <Node key={r.empId} emp={r} reportsOf={reportsOf} depth={0} collapsed={collapsed} toggle={toggle} />)}
          </ul>
        </Card>
        <Card title="Departments">
          <ul className="space-y-2 text-xs">
            {Object.entries(byDept).sort((a, b) => b[1] - a[1]).map(([d, n]) => (
              <li key={d} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-semibold text-slate-800">{d}</span>
                <span className="font-mono font-bold text-slate-600">{n}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Page>
  );
};
