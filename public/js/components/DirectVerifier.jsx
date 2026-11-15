// Direct Backend Authorization Verifier Component
function DirectVerifier({ knownEvents, onProbeSuccess }) {
  const [selectedId, setSelectedId] = React.useState("");
  const [probing, setProbing] = React.useState(false);
  const [probeResult, setProbeResult] = React.useState(null);

  const handleProbe = async () => {
    if (!selectedId) {
      alert("Please select an event to test direct API authorization.");
      return;
    }

    setProbing(true);
    setProbeResult({ status: "Probing...", authCheck: "Checking...", body: "Executing GET /events/" + selectedId });

    try {
      const res = await fetch(`/events/${selectedId}`, {
        headers: { "X-User-Id": "user_demo" }
      });

      const json = await res.json();

      let statusColor = "#10b981";
      let authCheckText = "ALLOWED (CATEGORY IS ON)";

      if (res.status === 403) {
        statusColor = "#ef4444";
        authCheckText = "BLOCKED BY PRIVACY CONTROLS (403 FORBIDDEN)";
      } else if (!res.ok) {
        statusColor = "#f59e0b";
        authCheckText = `HTTP Error ${res.status}`;
      }

      setProbeResult({
        status: `${res.status} ${res.statusText}`,
        statusColor,
        authCheck: authCheckText,
        body: JSON.stringify(json, null, 2)
      });

      if (onProbeSuccess) onProbeSuccess();
    } catch (err) {
      setProbeResult({
        status: "Network Error",
        statusColor: "#ef4444",
        authCheck: "Connection Failed",
        body: err.message
      });
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3>Direct Backend API Authorization Verifier</h3>
          <p className="section-desc">
            Directly test <code>GET /events/{'{id}'}</code> against the backend to verify that privacy is enforced at the HTTP boundary, not just in UI hiding.
          </p>
        </div>
      </div>

      <div className="verifier-body">
        <p>Select any event from memory and probe its endpoint directly:</p>
        <div className="verifier-controls">
          <select
            className="form-control"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select an event to probe...</option>
            {knownEvents.map((evt) => (
              <option key={evt.id} value={evt.id}>
                [{evt.type.toUpperCase()}] {evt.title} ({evt.id.substring(0, 8)}...)
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={handleProbe} disabled={probing || !selectedId}>
            {probing ? "Probing..." : "Execute GET /events/{id}"}
          </button>
        </div>

        {probeResult && (
          <div className="verifier-output">
            <h4>Backend HTTP Response:</h4>
            <div className="response-status-bar">
              <span>Status: <strong style={{ color: probeResult.statusColor }}>{probeResult.status}</strong></span>
              <span>Authorization: <strong style={{ color: probeResult.statusColor }}>{probeResult.authCheck}</strong></span>
            </div>
            <pre>{probeResult.body}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

window.DirectVerifier = DirectVerifier;
