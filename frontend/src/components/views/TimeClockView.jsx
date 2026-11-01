import React, { useEffect, useMemo, useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { distanceMeters } from '@shared/attendance';
import { addDays, fmtDate, fmtDuration, todayStr } from '@shared/dates';
import { Btn, Card, Icon, Page, PageHeader, StatusBadge, Table } from '../common/ui';

const METHODS = [
  { id: 'Biometric', icon: 'fingerprint', title: 'Biometric', desc: 'Fingerprint / face scan at office terminal' },
  { id: 'GPS', icon: 'my_location', title: 'GPS Mobile', desc: 'Geofenced location check (250 m of office)' },
  { id: 'Web', icon: 'computer', title: 'Web / Remote', desc: 'Browser check-in for approved remote work' },
];

export const TimeClockView = ({ onShowToast }) => {
  const { currentUser, offices, dayFor, clockIn, clockOut, toggleBreak } = useHrms();
  const [now, setNow] = useState(new Date());
  const [method, setMethod] = useState('Biometric');
  const [busy, setBusy] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const today = todayStr();
  // `now` in deps keeps live worked-time ticking.
  const day = useMemo(() => dayFor(currentUser, today), [dayFor, currentUser, today, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const office = offices.find((o) => o.id === currentUser.officeId) || offices[0];
  const checkedIn = !!day.inTime;
  const checkedOut = !!day.outTime;

  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayFor(currentUser, addDays(today, -i))),
    [dayFor, currentUser, today]
  );

  const report = (res, title, msg) => {
    if (res.ok) onShowToast(title, msg);
    else onShowToast('Action failed', res.error, 'error');
  };

  const doClockIn = async (location, notes) => report(await clockIn({ method, location, notes }), 'Checked in', `${method} check-in recorded. Have a productive day!`);

  const handleCheckIn = () => {
    if (method === 'Biometric') {
      // Simulated terminal scan — a real deployment receives this event from the device gateway.
      setBusy(true);
      setScanProgress(0);
      let p = 0;
      const t = setInterval(() => {
        p += 10;
        setScanProgress(p);
        if (p >= 100) {
          clearInterval(t);
          setBusy(false);
          doClockIn({ lat: office.lat, lng: office.lng, label: office.terminal, inFence: true }, 'Biometric match verified');
        }
      }, 120);
      return;
    }
    if (method === 'GPS') {
      if (!navigator.geolocation) {
        onShowToast('GPS unavailable', 'This browser does not support geolocation. Use Biometric or Web check-in.', 'error');
        return;
      }
      setBusy(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setBusy(false);
          const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          const nearest = offices
            .map((o) => ({ o, d: distanceMeters(here, o) }))
            .sort((a, b) => a.d - b.d)[0];
          const inFence = nearest.d <= nearest.o.radiusM;
          doClockIn(
            { ...here, accuracy: Math.round(pos.coords.accuracy), label: inFence ? nearest.o.name : `${(nearest.d / 1000).toFixed(1)} km from ${nearest.o.name}`, inFence },
            inFence ? 'GPS verified inside geofence' : 'Outside geofence — flagged for manager review'
          );
          if (!inFence) onShowToast('Outside geofence', `You are ${(nearest.d / 1000).toFixed(1)} km from the nearest office. Your check-in was recorded and flagged for review.`, 'warning');
        },
        (err) => {
          setBusy(false);
          onShowToast('Location error', err.message || 'Location permission denied.', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }
    doClockIn({ label: 'Web browser', inFence: false }, 'Remote web check-in');
  };

  return (
    <Page>
      <PageHeader
        kicker="TIME & ATTENDANCE"
        icon="fingerprint"
        title="Time Clock"
        subtitle={`${day.shift.name} (${day.shift.start} – ${day.shift.end}) • Grace ${day.shift.graceMin} min • Office: ${office.name}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gradient-to-r from-[#0a2540] to-[#0f345c] text-white rounded-2xl p-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="text-[11px] font-mono text-sky-300 uppercase font-bold">{fmtDate(today)} • {day.day}</div>
              <div className="text-5xl font-black font-tabular-data mt-1">
                {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <StatusBadge status={day.onBreak ? 'HALF_DAY' : day.status} label={day.onBreak ? 'On Break' : undefined} />
                {day.location && day.location.inFence === false && day.method === 'GPS' && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/30">OUTSIDE GEOFENCE</span>
                )}
                {!day.isWorkingDay && <span className="text-[11px] text-slate-300">Non-working day — any hours count as off-day overtime (2.0x).</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs min-w-[260px]">
              {[
                ['Check-in', day.inTime || '--:--'],
                ['Check-out', day.outTime || '--:--'],
                ['Worked', fmtDuration(day.workedMinutes)],
                ['Breaks', fmtDuration(day.breakMinutes)],
                ['Late by', day.lateMinutes ? `${day.lateMinutes} min` : '—'],
                ['Overtime', day.overtimeMinutes ? fmtDuration(day.overtimeMinutes) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-[#07192d]/70 rounded-lg p-2.5 border border-slate-700/60">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">{k}</div>
                  <div className="font-bold font-tabular-data mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Card title={checkedIn ? 'Shift actions' : 'Check-in method'}>
          {!checkedIn && (
            <div className="space-y-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                    method === m.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon name={m.icon} className={`text-[22px] ${method === m.id ? 'text-sky-600' : 'text-slate-400'}`} />
                  <span>
                    <span className="block text-xs font-bold text-slate-900">{m.title}</span>
                    <span className="block text-[11px] text-slate-500">{m.desc}</span>
                  </span>
                </button>
              ))}
              {busy && method === 'Biometric' && (
                <div className="pt-1">
                  <div className="text-[11px] font-mono text-slate-500 mb-1">Scanning fingerprint… {scanProgress}%</div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-600 transition-all" style={{ width: `${scanProgress}%` }} />
                  </div>
                </div>
              )}
              <Btn variant="success" icon="login" className="w-full py-2.5" onClick={handleCheckIn} disabled={busy}>
                {busy ? (method === 'GPS' ? 'Locating…' : 'Verifying…') : 'Check In'}
              </Btn>
            </div>
          )}
          {checkedIn && !checkedOut && (
            <div className="space-y-2">
              <div className="text-[11px] text-slate-500">
                Checked in via <strong>{day.method}</strong> at <strong>{day.inTime}</strong>
                {day.location?.label ? ` • ${day.location.label}` : ''}
              </div>
              <Btn
                variant="outline"
                icon={day.onBreak ? 'play_arrow' : 'coffee'}
                className="w-full py-2.5"
                onClick={async () => {
                  const res = await toggleBreak();
                  report(res, res.onBreak ? 'Break started' : 'Break ended', `Logged at ${res.time}.`);
                }}
              >
                {day.onBreak ? 'End Break' : 'Start Break'}
              </Btn>
              <Btn
                variant="danger"
                icon="logout"
                className="w-full py-2.5"
                onClick={async () => {
                  const res = await clockOut();
                  report(res, 'Checked out', `Check-out at ${res.time}. See you tomorrow!`);
                }}
              >
                Check Out
              </Btn>
            </div>
          )}
          {checkedOut && (
            <div className="text-center py-4">
              <Icon name="task_alt" className="text-[36px] text-emerald-600" />
              <div className="text-sm font-bold text-slate-900 mt-1">Shift complete</div>
              <div className="text-xs text-slate-500">{fmtDuration(day.workedMinutes)} worked today</div>
            </div>
          )}
        </Card>
      </div>

      {day.record?.breaks?.length > 0 && (
        <Card title="Today's breaks">
          <div className="flex flex-wrap gap-2">
            {day.record.breaks.map((b, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono">
                {b.start} – {b.end || 'ongoing'}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card title="Last 7 days" bodyClass="">
        <Table head={['Date', 'Status', 'In', 'Out', 'Worked', 'Breaks', 'Overtime', 'Method']} minWidth="min-w-[700px]">
          {week.map((d) => (
            <tr key={d.date} className="hover:bg-slate-50">
              <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{fmtDate(d.date)} <span className="text-slate-400 font-normal">{d.day.slice(0, 3)}</span></td>
              <td className="py-2.5 px-4"><StatusBadge status={d.status} /></td>
              <td className="py-2.5 px-4 font-mono">{d.inTime || '--:--'}</td>
              <td className="py-2.5 px-4 font-mono">{d.outTime || '--:--'}</td>
              <td className="py-2.5 px-4 font-mono font-bold">{d.workedMinutes ? fmtDuration(d.workedMinutes) : '—'}</td>
              <td className="py-2.5 px-4 font-mono">{d.breakMinutes ? `${d.breakMinutes}m` : '—'}</td>
              <td className="py-2.5 px-4 font-mono text-sky-700">{d.overtimeMinutes ? fmtDuration(d.overtimeMinutes) : '—'}</td>
              <td className="py-2.5 px-4 text-slate-500">{d.method || '—'}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </Page>
  );
};
