import { Navigate, Route, Routes } from "react-router-dom";
import { TopNav } from "./components/TopNav.jsx";
import { AbmPage } from "./modules/abm/AbmPage.jsx";
import { PipelinePage } from "./modules/pipeline/PipelinePage.jsx";
import { MarketingPage } from "./modules/marketing/MarketingPage.jsx";
import { DemoCallsPage } from "./modules/demo-calls/DemoCallsPage.jsx";
import { NameTagProvider } from "./context/NameTagContext.jsx";

export function App() {
  return (
    <NameTagProvider>
      <div className="wrap">
        <TopNav />
        <Routes>
          <Route path="/" element={<Navigate to="/pipeline" replace />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/demo-calls" element={<DemoCallsPage />} />
          <Route path="/marketing" element={<MarketingPage />} />
          <Route path="/abm" element={<AbmPage />} />
          <Route path="*" element={<Navigate to="/pipeline" replace />} />
        </Routes>
      </div>
    </NameTagProvider>
  );
}
