import React, { useState } from 'react';
import { STATUS_META } from '@shared/attendance';

export const Icon = ({ name, className = 'text-[16px]' }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

export const Avatar = ({ emp, size = 'w-9 h-9', className = '' }) => {
  const [broken, setBroken] = useState(false);
  const initials = (emp?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  if (!emp?.avatar || broken) {
    return (
      <div className={`${size} rounded-full bg-sky-100 text-sky-800 border border-sky-200 flex items-center justify-center font-bold text-xs shrink-0 ${className}`}>
        {initials}
      </div>
    );
  }
  return (
    <img
      src={emp.avatar}
      alt={emp.name}
      onError={() => setBroken(true)}
      className={`${size} rounded-full object-cover border border-slate-200 shrink-0 ${className}`}
    />
  );
};

export const PageHeader = ({ kicker, icon, title, subtitle, actions }) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-sky-600 font-bold">
        <Icon name={icon} />
        {kicker}
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">{title}</h1>
      {subtitle && <p className="text-xs text-slate-500 font-mono mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2.5 flex-wrap">{actions}</div>}
  </div>
);

export const Page = ({ children }) => (
  <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">{children}</div>
);

export const Card = ({ title, subtitle, actions, children, className = '', bodyClass = 'p-4 sm:p-5' }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden ${className}`}>
    {(title || actions) && (
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
    )}
    <div className={bodyClass}>{children}</div>
  </div>
);

export const StatCard = ({ label, value, hint, icon, tone = 'sky' }) => {
  const tones = {
    sky: 'text-sky-700 bg-sky-50',
    emerald: 'text-emerald-700 bg-emerald-50',
    amber: 'text-amber-700 bg-amber-50',
    rose: 'text-rose-700 bg-rose-50',
    purple: 'text-purple-700 bg-purple-50',
    slate: 'text-slate-700 bg-slate-100',
  };
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wide">{label}</span>
        {icon && (
          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}>
            <Icon name={icon} className="text-[18px]" />
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-slate-900 mt-2 font-tabular-data">{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1">{hint}</div>}
    </div>
  );
};

export const StatusBadge = ({ status, label }) => {
  const meta = STATUS_META[status] || { label: status, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border whitespace-nowrap ${meta.cls}`}>
      {label || meta.label}
    </span>
  );
};

const REQ_STATUS = {
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  FINALIZED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const Pill = ({ value }) => (
  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${REQ_STATUS[value] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
    {value}
  </span>
);

export const Modal = ({ title, subtitle, onClose, children, width = 'max-w-lg' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs" onClick={onClose}>
    <div
      className={`bg-white border border-slate-200 rounded-2xl w-full ${width} p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between border-b border-slate-200 pb-3 gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 font-mono mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700" type="button" aria-label="Close">
          <Icon name="close" className="text-[20px]" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export const Field = ({ label, children, className = '' }) => (
  <label className={`block text-xs ${className}`}>
    <span className="block font-mono text-slate-600 mb-1">{label}</span>
    {children}
  </label>
);

export const inputCls = 'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white';

export const Btn = ({ variant = 'primary', icon, children, className = '', ...rest }) => {
  const variants = {
    primary: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sm',
    dark: 'bg-[#0a2540] hover:bg-slate-800 text-white',
    outline: 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    danger: 'bg-rose-600 hover:bg-rose-500 text-white',
    ghost: 'text-sky-600 hover:text-sky-700 hover:bg-sky-50',
  };
  return (
    <button
      type="button"
      className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
};

export const Table = ({ head, children, minWidth = 'min-w-[800px]' }) => (
  <div className="overflow-x-auto w-full">
    <table className={`w-full ${minWidth} text-left text-xs border-collapse`}>
      <thead>
        <tr className="bg-slate-100 text-slate-700 font-mono uppercase text-[11px] border-b border-slate-200">
          {head.map((h, i) => (
            <th key={i} className={`py-3 px-4 font-bold ${typeof h === 'object' ? h.className : ''}`}>
              {typeof h === 'object' ? h.label : h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </div>
);

export const EmptyRow = ({ cols, text = 'No records found.' }) => (
  <tr>
    <td colSpan={cols} className="py-8 text-center text-slate-400 font-mono">{text}</td>
  </tr>
);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="flex items-center gap-2 overflow-x-auto pb-1">
    {tabs.map((t) => (
      <button
        key={t.id}
        type="button"
        onClick={() => onChange(t.id)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
          value === t.id ? 'bg-[#0a2540] text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
        }`}
      >
        {t.label}
      </button>
    ))}
  </div>
);

export const AccessDenied = () => (
  <Page>
    <div className="bg-white border border-rose-200 rounded-2xl p-10 text-center shadow-xs">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
        <Icon name="lock" className="text-[28px]" />
      </div>
      <h2 className="text-lg font-black text-slate-900 mt-4">Access restricted</h2>
      <p className="text-xs text-slate-500 mt-1">Your role does not have permission to open this module.</p>
    </div>
  </Page>
);
