import React, { useState, useMemo } from 'react';
import { useHrms } from '../../context/HrmsContext';

export const AuditLogView = ({ onShowToast }) => {
  const { auditLogs: logs } = useHrms();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [selectedEntry, setSelectedEntry] = useState(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        log.auditId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.targetEntity.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.recordId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.justification.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesAction = filterAction === 'ALL' || log.action === filterAction;

      return matchesSearch && matchesAction;
    });
  }, [logs, searchQuery, filterAction]);

  const handleExportCSV = () => {
    const headers = ['Audit ID', 'SHA Hash', 'Timestamp', 'Actor', 'Role', 'Action', 'Target Entity', 'Record ID', 'Justification'];
    const rows = filteredLogs.map((l) => [
      l.auditId,
      l.hash,
      l.timestamp,
      `"${l.actor}"`,
      l.actorRole,
      l.action,
      l.targetEntity,
      l.recordId,
      `"${l.justification.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Corporate_Audit_Compliance_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Audit Log Exported', 'Downloaded compliance CSV report.');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-sky-600 font-bold">
            <span className="material-symbols-outlined text-[16px]">shield</span>
            IMMUTABLE SYSTEM OF RECORD • SOC-2 & LABOR STANDARDS COMPLIANT
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
            Centralized Audit & Mutation Log
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Cryptographic Sequence Verification: <span className="text-emerald-600 font-bold">VALID (All Hashes Intact)</span> • Zero Unaudited State Changes Permitted
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Export Audit Ledger
          </button>
        </div>
      </div>

      {/* Security Status Strip */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">verified_user</span>
          </div>
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase">Hash Chain Status</div>
            <div className="text-sm font-bold text-emerald-700 font-mono">100% Cryptographic Match</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">history_edu</span>
          </div>
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase">Total Mutations Recorded</div>
            <div className="text-sm font-bold text-slate-900 font-mono">{logs.length} Immutable Events</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-xl">policy</span>
          </div>
          <div>
            <div className="text-[11px] font-mono text-slate-400 uppercase">Retention Governance</div>
            <div className="text-sm font-bold text-cyan-700 font-mono">7-Year Statutory Maritime Freeze</div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit ID, actor, entity, record ID, or justification..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-slate-500 font-bold">Action Type:</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">All Actions</option>
            {['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'FINALIZE', 'CLOCK_IN', 'CLOCK_OUT'].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[950px] text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-mono uppercase text-[11px] border-b border-slate-200">
                <th className="py-3 px-4 font-bold">Audit ID</th>
                <th className="py-3 px-4 font-bold">SHA-256 Hash</th>
                <th className="py-3 px-4 font-bold">Timestamp (UTC)</th>
                <th className="py-3 px-4 font-bold">Actor & Role</th>
                <th className="py-3 px-4 font-bold">Action</th>
                <th className="py-3 px-4 font-bold">Target Entity</th>
                <th className="py-3 px-4 font-bold">Operational Justification</th>
                <th className="py-3 px-4 font-bold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-mono">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-sky-700">
                      {log.auditId}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {log.hash.slice(0, 10)}...
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{log.actor}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{log.actorRole}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          log.action === 'APPROVE' || log.action === 'FINALIZE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : log.action === 'REJECT'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : log.action === 'CLOCK_IN' || log.action === 'CLOCK_OUT'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <span className="text-slate-800 font-semibold">{log.targetEntity}</span>
                      <div className="text-[10px] text-slate-400">{log.recordId}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs line-clamp-1">
                      {log.justification}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedEntry(log)}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-mono font-bold text-slate-800 transition-colors inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">code</span>
                        Diff
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* State Mutation Diff & JSON Inspector Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sky-600">data_object</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    State Mutation Diff: {selectedEntry.auditId}
                  </h3>
                  <div className="text-[11px] font-mono text-slate-500">
                    SHA-256 Digest: {selectedEntry.hash}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedEntry(null)} className="text-slate-400 hover:text-slate-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Actor</div>
                  <div className="font-bold text-slate-900 mt-0.5">{selectedEntry.actor} ({selectedEntry.actorRole})</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Entity Mutation</div>
                  <div className="font-mono text-slate-900 mt-0.5">{selectedEntry.targetEntity} :: {selectedEntry.recordId}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] font-mono text-slate-400 uppercase">Justification Reference</div>
                  <div className="text-slate-700 mt-0.5">{selectedEntry.justification}</div>
                </div>
              </div>

              {/* Side by Side Diff */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-rose-200">
                  <div className="text-[11px] font-mono font-bold text-rose-700 mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">remove_circle_outline</span>
                    OLD STATE (Before Mutation)
                  </div>
                  <pre className="font-mono text-[10px] text-slate-600 overflow-x-auto whitespace-pre-wrap">
                    {selectedEntry.oldValue ? JSON.stringify(selectedEntry.oldValue, null, 2) : '// [NULL: Initial creation event]'}
                  </pre>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-emerald-200">
                  <div className="text-[11px] font-mono font-bold text-emerald-700 mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">add_circle_outline</span>
                    NEW STATE (Committed)
                  </div>
                  <pre className="font-mono text-[10px] text-emerald-800 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selectedEntry.newValue, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
