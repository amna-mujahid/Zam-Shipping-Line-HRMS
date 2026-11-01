import React from 'react';

export const Toast = ({
  show,
  title,
  message,
  type = 'success',
  onClose,
}) => {
  if (!show) return null;

  const bgStyles = {
    success: 'bg-emerald-900 border-emerald-500 text-white',
    info: 'bg-[#0a2540] border-sky-500 text-white',
    warning: 'bg-amber-900 border-amber-500 text-white',
    error: 'bg-rose-900 border-rose-500 text-white',
  }[type] || 'bg-slate-900 border-slate-700 text-white';

  const iconName = {
    success: 'check_circle',
    info: 'info',
    warning: 'warning',
    error: 'error',
  }[type] || 'notifications';

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-200">
      <div className={`p-4 rounded-xl border shadow-xl flex items-start gap-3 ${bgStyles}`}>
        <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5">
          {iconName}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold tracking-tight">{title}</h4>
          <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white p-1 rounded-md shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};
