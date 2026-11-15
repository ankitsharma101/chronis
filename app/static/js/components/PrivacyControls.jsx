// Privacy Controls React Component
function PrivacyControls({ permissions, onToggle, loading }) {
  const categories = [
    { id: "conversation", name: "Conversation", icon: "💬", desc: "Transcripts, dialogues & chats" },
    { id: "location", name: "Location", icon: "📍", desc: "Coordinates, venues & check-ins" },
    { id: "physiological", name: "Physiological", icon: "💓", desc: "Heart rate, vitals, sleep & HRV" },
    { id: "note", name: "Note", icon: "📝", desc: "Personal thoughts & reminders" }
  ];

  const disabledCategories = Object.entries(permissions)
    .filter(([_, isEnabled]) => !isEnabled)
    .map(([cat]) => cat.charAt(0).toUpperCase() + cat.slice(1));

  const allActive = disabledCategories.length === 0;

  return (
    <section className="card privacy-card">
      <div className="card-header">
        <div className="card-title-group">
          <h2>🛡️ Privacy Controls (Backend Enforced)</h2>
          <p className="section-desc">
            Toggle categories ON or OFF. <strong>Enforced strictly by the backend API</strong> — disabled categories are never returned over the network.
          </p>
        </div>
        <span className={`badge ${allActive ? 'badge-success' : 'badge-denied'}`}>
          {allActive ? "All Categories Active" : `${disabledCategories.length} Restricted`}
        </span>
      </div>

      <div className="toggles-grid">
        {categories.map((cat) => {
          const isEnabled = permissions[cat.id] ?? true;
          return (
            <div
              key={cat.id}
              className={`toggle-item ${!isEnabled ? 'disabled' : ''}`}
            >
              <div className="toggle-meta">
                <span className="type-icon">{cat.icon}</span>
                <div className="toggle-labels">
                  <strong>{cat.name}</strong>
                  <small>{cat.desc}</small>
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  disabled={loading}
                  onChange={(e) => onToggle(cat.id, e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          );
        })}
      </div>

      {!allActive && (
        <div className="alert alert-warning">
          <span className="alert-icon">⚠️</span>
          <div className="alert-content">
            <strong>Backend Data Filtering Active:</strong> {disabledCategories.join(", ")} (OFF)
            <div className="alert-sub">
              Direct requests for disabled data are rejected with HTTP 403 Forbidden and logged in the audit trail.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

window.PrivacyControls = PrivacyControls;
