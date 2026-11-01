import React, { useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { COMPANY } from '../../config/offices';
import { Icon, inputCls } from '../common/ui';

// Username + password only. The role (HR / Department Head / Employee) comes from the
// account in the database and decides which screens open after sign-in.
export const LoginView = ({ onLoggedIn }) => {
  const { login } = useHrms();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await login(username, password);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onLoggedIn(res.user);
    return undefined;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#07192d] via-[#0a2540] to-[#0f345c] p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8 bg-[#0a2540] text-white flex flex-col justify-between gap-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-sky-600 flex items-center justify-center">
                <Icon name="corporate_fare" className="text-[22px]" />
              </div>
              <div>
                <div className="text-sm font-black tracking-wide">{COMPANY.name}</div>
                <div className="text-[10px] text-sky-400 tracking-wider uppercase font-mono font-bold">{COMPANY.tagline}</div>
              </div>
            </div>
            <h1 className="text-2xl font-black mt-8 leading-tight">Human Resource Management System</h1>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Employee records, time &amp; attendance, payroll, self-service and workforce analytics — in one place.
            </p>
          </div>
          <ul className="space-y-2 text-xs text-slate-300">
            {['Centralized employee directory & org chart', 'Biometric / GPS / web check-ins with overtime', 'Payroll linked to attendance & leave (PKR, FBR slabs)', 'Role-based access: HR · Department Head · Employee'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Icon name="check_circle" className="text-[16px] text-emerald-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={submit} className="p-8 space-y-5 flex flex-col justify-center">
          <div>
            <h2 className="text-lg font-black text-slate-900">Sign in</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter your username and password.</p>
          </div>

          <div className="space-y-3">
            <input required autoFocus autoComplete="username" placeholder="Username (employee code) or email" value={username} onChange={(e) => setUsername(e.target.value)} className={inputCls} />
            <input type="password" required autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </div>

          {error && (
            <div className="text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-start gap-2">
              <Icon name="error" className="text-[16px] shrink-0" /> {error}
            </div>
          )}
          <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-[#0a2540] hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-60">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-[10px] text-slate-400">Your access level is set by HR. Contact HR if you cannot sign in.</p>
        </form>
      </div>
    </div>
  );
};
