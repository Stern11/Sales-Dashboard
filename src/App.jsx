import { Navigate, Route, Routes } from "react-router-dom";
import { TopNav } from "./components/TopNav.jsx";
import { AbmPage } from "./modules/abm/AbmPage.jsx";
import { PipelinePage } from "./modules/pipeline/PipelinePage.jsx";
import { SourcesPage } from "./modules/sources/SourcesPage.jsx";

export function App() {
  return (
    <div className="wrap">
      <TopNav />
      <Routes>
        <Route path="/" element={<Navigate to="/abm" replace />} />
        <Route path="/abm" element={<AbmPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="*" element={<Navigate to="/abm" replace />} />
      </Routes>
    </div>
  );
}
