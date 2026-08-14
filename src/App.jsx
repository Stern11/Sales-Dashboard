import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar, MODULES } from "./components/Sidebar.jsx";
import { OverviewPage } from "./modules/overview/OverviewPage.jsx";
import { AbmPage } from "./modules/abm/AbmPage.jsx";
import { PipelinePage } from "./modules/pipeline/PipelinePage.jsx";
import { MarketingPage } from "./modules/marketing/MarketingPage.jsx";
import { DemoCallsPage } from "./modules/demo-calls/DemoCallsPage.jsx";
import { AccountExpansionPage } from "./modules/account-expansion/AccountExpansionPage.jsx";
import { AccountDetailPage } from "./modules/account-expansion/AccountDetailPage.jsx";
import { NameTagProvider } from "./context/NameTagContext.jsx";
import { AuthProvider, useAuthContext } from "./context/AuthContext.jsx";
import { LoginPage } from "./components/LoginPage.jsx";

// Derived from the same MODULES list the sidebar renders its links from —
// one source of truth for "route -> label" instead of a second hardcoded
// list that could drift out of sync with it.
function PageHeading() {
  const { pathname } = useLocation();
  const current = MODULES.find((m) => pathname.startsWith(m.to));
  return <h1 className="page-heading">{current?.label || "Dashboard"}</h1>;
}

function DashboardShell() {
  return (
    <NameTagProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <div className="main-content-inner">
            <PageHeading />
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/pipeline" element={<PipelinePage />} />
              <Route path="/demo-calls" element={<DemoCallsPage />} />
              <Route path="/marketing" element={<MarketingPage />} />
              <Route path="/abm" element={<AbmPage />} />
              <Route path="/expansion" element={<AccountExpansionPage />} />
              <Route path="/expansion/:accountId" element={<AccountDetailPage />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </NameTagProvider>
  );
}

/** Nothing that reads real data ever mounts until this resolves to authenticated:true — see AuthContext.jsx. */
function AuthGate() {
  const { loading, authenticated } = useAuthContext();
  if (loading) return <div className="loading">Loading…</div>;
  if (!authenticated) return <LoginPage />;
  return <DashboardShell />;
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
