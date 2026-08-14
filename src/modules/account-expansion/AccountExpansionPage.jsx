import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AsyncState } from "../../components/AsyncState.jsx";
import { KpiRow } from "../../components/KpiRow.jsx";
import { PageMeta } from "../../components/Sidebar.jsx";
import { useAccountExpansionList } from "./useAccountExpansionData.js";
import { AccountsTable } from "./AccountsTable.jsx";
import { AddAccountModal } from "./AddAccountModal.jsx";

/**
 * Account Expansion portfolio — Heizen's existing clients being tracked for
 * expansion/upsell. Its own top-level module, not sourced from or nested
 * inside ABM Outreach (that page tracks prospects; this one tracks accounts
 * already won).
 */
export function AccountExpansionPage() {
  const { data: accounts, loading, error, refresh } = useAccountExpansionList();
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  const kpis = useMemo(() => {
    const list = accounts || [];
    return {
      total: list.length,
      accountsWithAreas: list.filter((a) => Number(a.area_count) > 0).length,
      totalAreas: list.reduce((sum, a) => sum + Number(a.area_count || 0), 0),
      validatedAreas: list.reduce((sum, a) => sum + Number(a.validated_count || 0), 0),
      needingResearch: list.filter((a) => !a.latest_signal_finding).length,
    };
  }, [accounts]);

  function openAccount(id) {
    navigate(`/expansion/${id}`);
  }

  return (
    <div>
      <div className="pipeline-toolbar">
        <button type="button" className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Account</button>
        <PageMeta onRefresh={refresh} style={{ marginBottom: 0 }} />
      </div>
      <AsyncState loading={loading && !accounts} error={error}>
        {accounts && (
          <>
            <KpiRow
              items={[
                { label: "Total Accounts", value: kpis.total },
                { label: "Accounts with Expansion Areas", value: `${kpis.accountsWithAreas} / ${kpis.total}` },
                { label: "Total Expansion Areas", value: kpis.totalAreas },
                { label: "Validated Expansion Areas", value: kpis.validatedAreas },
                { label: "Accounts Needing Research", value: kpis.needingResearch },
              ]}
            />
            <section>
              <h2>{accounts.length} Account{accounts.length === 1 ? "" : "s"}</h2>
              <p className="subtitle" style={{ marginBottom: 10 }}>
                Click an account to open its expansion workspace — current footprint, expansion
                areas, whitespace, research signals, stakeholders, and open questions.
              </p>
              {accounts.length === 0 ? (
                <p className="empty">No accounts yet — click "+ Add Account" to start tracking one.</p>
              ) : (
                <AccountsTable accounts={accounts} onOpenAccount={openAccount} />
              )}
            </section>
          </>
        )}
      </AsyncState>
      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onCreated={(id) => { setShowAddModal(false); refresh(); navigate(`/expansion/${id}`); }}
        />
      )}
    </div>
  );
}
