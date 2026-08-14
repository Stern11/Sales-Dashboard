import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Sidebar, MODULES } from "./components/Sidebar.jsx";
import { NameTagProvider } from "./context/NameTagContext.jsx";
import { AuthProvider, useAuthContext } from "./context/AuthContext.jsx";

// Every page was imported eagerly, so one bundle carried the Kanban board,
// the hand-built SVG trend chart, the mention autocomplete and all twelve
// modals — and the browser downloaded and parsed the lot before it could
// paint the *login screen*, which needs none of it. Splitting per route
// means each module's code arrives when someone navigates to it.
//
// LoginPage is split for the same reason in reverse: it's the only pre-auth
// code, and once you're signed in you never render it again.
const LoginPage = lazy(() => import("./components/LoginPage.jsx").then((m) => ({ default: m.LoginPage })));
const OverviewPage = lazy(() => import("./modules/overview/OverviewPage.jsx").then((m) => ({ default: m.OverviewPage })));
const AbmPage = lazy(() => import("./modules/abm/AbmPage.jsx").then((m) => ({ default: m.AbmPage })));
const PipelinePage = lazy(() => import("./modules/pipeline/PipelinePage.jsx").then((m) => ({ default: m.PipelinePage })));
const MarketingPage = lazy(() => import("./modules/marketing/MarketingPage.jsx").then((m) => ({ default: m.MarketingPage })));
const DemoCallsPage = lazy(() => import("./modules/demo-calls/DemoCallsPage.jsx").then((m) => ({ default: m.DemoCallsPage })));
const AccountExpansionPage = lazy(() => import("./modules/account-expansion/AccountExpansionPage.jsx").then((m) => ({ default: m.AccountExpansionPage })));
const AccountDetailPage = lazy(() => import("./modules/account-expansion/AccountDetailPage.jsx").then((m) => ({ default: m.AccountDetailPage })));

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
            {/* The shell (sidebar, heading) stays put while a route's chunk
                loads, so navigation doesn't blank the whole page. */}
            <Suspense fallback={<div className="loading">Loading…</div>}>
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
            </Suspense>
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
  if (!authenticated) {
    return (
      <Suspense fallback={<div className="loading">Loading…</div>}>
        <LoginPage />
      </Suspense>
    );
  }
  return <DashboardShell />;
}

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
