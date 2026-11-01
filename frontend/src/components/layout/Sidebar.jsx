import React from 'react';
import { COMPANY } from '../../config/offices';
import { useHrms } from '../../context/HrmsContext';
import { ROLE_BADGE, ROLE_LABELS, PERMISSIONS, viewsForRole } from '@shared/permissions';
import { Avatar } from '../common/ui';

export const Sidebar = ({ activeView, onSelectView, isMobileOpen, onCloseMobile }) => {
  const { currentUser, role, can, regularizations, leaves, logout } = useHrms();

  const scopeAll = can(PERMISSIONS.ATTENDANCE_ALL);
  const badges = {
    pendingRegularizations: can(PERMISSIONS.REGULARIZE_APPROVE)
      ? regularizations.filter((r) => r.status === 'Pending').length
      : regularizations.filter((r) => r.status === 'Pending' && r.empId === currentUser.empId).length,
    pendingLeaves: can(PERMISSIONS.LEAVE_ALL)
      ? leaves.filter((l) => l.status === 'Pending').length
      : can(PERMISSIONS.LEAVE_TEAM)
        ? leaves.filter((l) => !l.minimal && l.status === 'Pending' && l.managerStatus === 'Pending').length
        : leaves.filter((l) => l.status === 'Pending' && l.empId === currentUser.empId).length,
  };

  // Group the role's permitted views by nav section, preserving order.
  const groups = [];
  viewsForRole(role).forEach((v) => {
    let g = groups.find((x) => x.section === v.section);
    if (!g) groups.push((g = { section: v.section, items: [] }));
    g.items.push(v);
  });

  const handleNavClick = (view) => {
    onSelectView(view);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#07192d] text-slate-200">
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 bg-[#0a2540] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-black tracking-wide text-white truncate">{COMPANY.name}</span>
            <span className="text-[10px] text-sky-400 tracking-wider uppercase font-mono font-bold">{COMPANY.tagline}</span>
          </div>
        </div>
        <button className="lg:hidden p-1 text-slate-400 hover:text-white" onClick={onCloseMobile} type="button">
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Signed-in user */}
      <div className="p-3 border-b border-slate-800 bg-[#092038] shrink-0">
        <div className="flex items-center gap-2.5">
          <Avatar emp={currentUser} size="w-9 h-9" className="border-slate-600" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
            <div className="text-[10px] text-slate-400 truncate">{currentUser.designation}</div>
          </div>
          <span className={`px-2 py-0.5 rounded-full border text-[9px] font-mono font-bold uppercase ${ROLE_BADGE[role]}`}>
            {ROLE_LABELS[role]}
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((group) => (
          <div key={group.section} className="space-y-1">
            <div className="px-3 text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">{group.section}</div>
            {group.items.map((item) => {
              const isActive = activeView === item.id;
              const label = !scopeAll && item.selfLabel ? item.selfLabel : item.label;
              const badge = item.badgeKey ? badges[item.badgeKey] : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive ? 'bg-sky-600 text-white font-bold shadow-sm' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-white' : 'text-slate-400'}`}>{item.icon}</span>
                    <span className="truncate">{label}</span>
                  </span>
                  {badge > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-amber-500 text-slate-950 font-bold">{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800 bg-[#092038] shrink-0">
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-white"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex w-64 shrink-0 h-screen sticky top-0 z-30 shadow-lg">{sidebarContent}</aside>
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={onCloseMobile} />
          <div className="relative w-64 max-w-[80vw] h-full z-10 shadow-2xl">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
