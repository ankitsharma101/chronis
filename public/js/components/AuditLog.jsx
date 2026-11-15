// Audit Log React Component
function AuditLog({ auditLogs, total, onRefresh, loading }) {
  const categoryMeta = {
    conversation: { badgeClass: "badge-conversation" },
    location: { badgeClass: "badge-location" },
    physiological: { badgeClass: "badge-physiological" },
    note: { badgeClass: "badge-note" }
  };

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>Audit Trail (Immutable & Read-Only)</h3>
          <p className="section-desc">
            Append-only security log recording every read, write, toggle, and denied access attempt.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onRefresh} disabled={loading}>
          🔄 Refresh
        </button>
      </div>

      <div className="table-responsive">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Timestamp (UTC)</th>
              <th>Action</th>
              <th>Category</th>
              <th>Result</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center">Loading audit records...</td>
              </tr>
            ) : auditLogs.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center">No audit records logged yet.</td>
              </tr>
            ) : (
              auditLogs.map((log) => {
                let resultBadge = "badge-success";
                if (log.result === "DENIED") resultBadge = "badge-denied";
                else if (log.result === "ERROR") resultBadge = "badge-error";

                return (
                  <tr key={log.id}>
                    <td><small>{formatTimestamp(log.timestamp)}</small></td>
                    <td><strong>{log.action}</strong></td>
                    <td>
                      {log.event_type ? (
                        <span className={`badge ${categoryMeta[log.event_type]?.badgeClass || ''}`}>
                          {log.event_type}
                        </span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td><span className={`badge ${resultBadge}`}>{log.result}</span></td>
                    <td><small>{log.details || "-"}</small></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.AuditLog = AuditLog;
