/**
 * Standardizes the loading/error/empty states every module page needs
 * around its `useApiData` result, so pages only render their real content.
 */
export function AsyncState({ loading, error, empty, emptyMessage, children }) {
  if (loading) return <div className="loading">Loading live data from HubSpot…</div>;
  if (error) return <div className="error">Couldn't load live data: {error}</div>;
  if (empty) return <div className="empty">{emptyMessage || "Nothing to show yet."}</div>;
  return children;
}
