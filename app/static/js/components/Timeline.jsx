// Timeline React Component
function Timeline({
  events,
  total,
  page,
  limit,
  hasMore,
  currentFilter,
  onFilterChange,
  onPageChange,
  onDelete,
  permissions,
  loading
}) {
  const categoryMeta = {
    conversation: { icon: "💬", badgeClass: "badge-conversation", name: "Conversation" },
    location: { icon: "📍", badgeClass: "badge-location", name: "Location" },
    physiological: { icon: "💓", badgeClass: "badge-physiological", name: "Physiological" },
    note: { icon: "📝", badgeClass: "badge-note", name: "Note" }
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
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  return (
    <div>
      {/* Filter and Pagination Toolbar */}
      <div className="toolbar">
        <div className="filter-group">
          <span className="filter-label">Filter Category:</span>
          {["all", "conversation", "location", "physiological", "note"].map((type) => (
            <button
              key={type}
              className={`filter-chip ${currentFilter === type ? 'active' : ''}`}
              onClick={() => onFilterChange(type)}
            >
              {type === "all" ? "All" : `${categoryMeta[type]?.icon} ${categoryMeta[type]?.name}`}
            </button>
          ))}
        </div>

        <div className="page-controls">
          <span className="page-summary">Showing {startIdx}-{endIdx} of {total}</span>
          <button
            className="btn btn-icon"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(-1)}
          >
            ◀
          </button>
          <span>Page {page}</span>
          <button
            className="btn btn-icon"
            disabled={!hasMore || loading}
            onClick={() => onPageChange(1)}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Timeline List */}
      <div className="timeline">
        {loading ? (
          <div className="loading-state">Loading timeline events...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            ⏳ No events found.
            {currentFilter !== "all" && !permissions[currentFilter] && (
              <div style={{ marginTop: "0.5rem", color: "#e11d48", fontWeight: 500 }}>
                Category '{currentFilter}' is turned OFF in Privacy Controls. Backend blocked all records.
              </div>
            )}
          </div>
        ) : (
          events.map((evt) => {
            const meta = categoryMeta[evt.type] || { icon: "📌", badgeClass: "badge-secondary", name: evt.type };
            return (
              <div className="timeline-item" key={evt.id}>
                <div className="timeline-marker">{meta.icon}</div>
                <div className="timeline-card">
                  <div className="event-top">
                    <h4 className="event-title">{evt.title}</h4>
                    <div className="event-badges">
                      <span className={`badge ${meta.badgeClass}`}>
                        {meta.icon} {meta.name}
                      </span>
                    </div>
                  </div>
                  <div className="event-content">{evt.content}</div>
                  <div className="event-meta">
                    <div className="event-time">
                      <span>🕒</span>
                      <span>{formatTimestamp(evt.timestamp)}</span>
                    </div>
                    <div className="event-actions">
                      <button
                        className="btn btn-danger-outline"
                        onClick={() => onDelete(evt.id, evt.title)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

window.Timeline = Timeline;
