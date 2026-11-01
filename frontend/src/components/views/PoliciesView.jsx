import React, { useState } from 'react';
import { useHrms } from '../../context/HrmsContext';
import { fmtDate } from '@shared/dates';
import { Btn, Card, Icon, Page, PageHeader } from '../common/ui';

export const PoliciesView = ({ onShowToast }) => {
  const { policies, policyAcks, currentUser, acknowledgePolicy } = useHrms();
  const [openId, setOpenId] = useState(policies[0].id);
  const acks = policyAcks[currentUser.empId] || [];
  const ackOf = (id) => acks.find((a) => a.policyId === id);
  const policy = policies.find((p) => p.id === openId);

  return (
    <Page>
      <PageHeader
        kicker="MY SELF-SERVICE"
        icon="menu_book"
        title="Company Policies"
        subtitle={`${acks.length} of ${policies.length} policies acknowledged`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Policy library" bodyClass="p-2">
          <ul className="space-y-1">
            {policies.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className={`w-full text-left p-3 rounded-lg flex items-start gap-3 ${openId === p.id ? 'bg-sky-50 border border-sky-200' : 'hover:bg-slate-50 border border-transparent'}`}
                >
                  <Icon name={ackOf(p.id) ? 'task_alt' : 'description'} className={`text-[18px] mt-0.5 ${ackOf(p.id) ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-slate-900">{p.title}</span>
                    <span className="block text-[10px] font-mono text-slate-500">{p.category} • v{p.version}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card
          className="lg:col-span-2"
          title={policy.title}
          subtitle={`${policy.category} • Version ${policy.version} • Effective ${fmtDate(policy.effective)}`}
        >
          <p className="text-xs text-slate-600 mb-4">{policy.summary}</p>
          <div className="space-y-4">
            {policy.sections.map((s) => (
              <section key={s.heading}>
                <h4 className="text-sm font-bold text-slate-900">{s.heading}</h4>
                <p className="text-xs text-slate-700 leading-relaxed mt-1">{s.body}</p>
              </section>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between gap-3 flex-wrap">
            {ackOf(policy.id) ? (
              <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                <Icon name="verified" /> You acknowledged this policy on {fmtDate(ackOf(policy.id).at)}
              </span>
            ) : (
              <>
                <span className="text-xs text-slate-500">Please confirm you have read and understood this policy.</span>
                <Btn
                  variant="dark"
                  icon="check"
                  onClick={async () => {
                    const r = await acknowledgePolicy(policy.id);
                    if (r.ok) onShowToast('Policy acknowledged', policy.title);
                    else onShowToast('Not saved', r.error, 'error');
                  }}
                >
                  I acknowledge
                </Btn>
              </>
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
};
