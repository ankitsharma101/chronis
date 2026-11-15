// Main Chronis React Application
const { useState, useEffect, useCallback } = React;

function App() {
  const userId = "user_demo";

  // State
  const [permissions, setPermissions] = useState({
    conversation: true,
    location: true,
    physiological: true,
    note: true
  });
  const [events, setEvents] = useState([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const [currentFilter, setCurrentFilter] = useState("all");
  const [knownEvents, setKnownEvents] = useState([]);

  const [auditLogs, setAuditLogs] = useState([]);
  const [totalAuditLogs, setTotalAuditLogs] = useState(0);

  const [activeTab, setActiveTab] = useState("timeline");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Fetch Permissions
  const fetchPermissions = useCallback(async () => {
    try {
      setLoadingPerms(true);
      const res = await fetch("/permissions", {
        headers: { "X-User-Id": userId }
      });
      if (!res.ok) throw new Error("Failed to load permissions");
      const data = await res.json();
      setPermissions(data.permissions);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoadingPerms(false);
    }
  }, [userId]);

  // Fetch Events
  const fetchEvents = useCallback(async (targetPage = page, targetFilter = currentFilter) => {
    try {
      setLoadingEvents(true);
      let url = `/events?page=${targetPage}&limit=${limit}`;
      if (targetFilter !== "all") {
        url += `&type=${targetFilter}`;
      }

      const res = await fetch(url, {
        headers: { "X-User-Id": userId }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load events`);

      const data = await res.json();
      setEvents(data.events);
      setTotalEvents(data.total);
      setHasMore(data.has_more);

      // Accumulate known events for verifier dropdown
      setKnownEvents((prev) => {
        const map = new Map(prev.map(e => [e.id, e]));
        data.events.forEach(e => map.set(e.id, e));
        return Array.from(map.values());
      });
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoadingEvents(false);
    }
  }, [page, currentFilter, limit, userId]);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoadingAudit(true);
      const res = await fetch("/audit-log?limit=50", {
        headers: { "X-User-Id": userId }
      });
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = await res.json();
      setAuditLogs(data.audit_logs || []);
      setTotalAuditLogs(data.total || 0);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoadingAudit(false);
    }
  }, [userId]);

  // Initial Load
  useEffect(() => {
    fetchPermissions();
    fetchEvents(1, "all");
    fetchAuditLogs();
  }, [fetchPermissions, fetchEvents, fetchAuditLogs]);

  // Toggle Category Permission
  const handleToggle = async (category, isEnabled) => {
    try {
      const payload = { [category]: isEnabled };
      const res = await fetch("/permissions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Failed to update permission");

      const data = await res.json();
      setPermissions(data.permissions);
      showToast(`Privacy updated: ${category.toUpperCase()} is now ${isEnabled ? 'ON' : 'OFF'}`);

      // Backend immediately stops returning that category: refresh timeline and audit log
      fetchEvents(page, currentFilter);
      fetchAuditLogs();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // Filter Change
  const handleFilterChange = (newFilter) => {
    setCurrentFilter(newFilter);
    setPage(1);
    fetchEvents(1, newFilter);
  };

  // Page Change
  const handlePageChange = (delta) => {
    const newPage = Math.max(1, page + delta);
    setPage(newPage);
    fetchEvents(newPage, currentFilter);
  };

  // Create Event
  const handleCreateEvent = async (eventData) => {
    const res = await fetch("/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": userId
      },
      body: JSON.stringify(eventData)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error creating event");
    }

    const created = await res.json();
    setKnownEvents(prev => [created, ...prev]);
    showToast("Event created successfully");

    fetchEvents(1, currentFilter);
    fetchAuditLogs();
  };

  // Delete Event
  const handleDeleteEvent = async (id, title) => {
    if (!confirm(`Delete event "${title}"?`)) return;

    try {
      const res = await fetch(`/events/${id}`, {
        method: "DELETE",
        headers: { "X-User-Id": userId }
      });
      if (!res.ok) throw new Error("Failed to delete event");

      showToast("Event deleted successfully");
      fetchEvents(page, currentFilter);
      fetchAuditLogs();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div>
      {/* Navbar */}
      <header className="navbar">
        <div className="nav-container">
          <div className="brand">
            <span className="brand-icon">⏳</span>
            <div className="brand-text">
              <span className="brand-title">CHRONIS</span>
              <span className="brand-subtitle">Privacy-Aware Memory Timeline (React 18)</span>
            </div>
          </div>
          <div className="nav-actions">
            <div className="user-pill">
              <span className="user-avatar">👤</span>
              <span>{userId}</span>
            </div>
            <a href="/docs" target="_blank" className="btn btn-secondary btn-sm">
              📖 API Docs
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container">
        {/* Privacy Controls Component */}
        <PrivacyControls
          permissions={permissions}
          onToggle={handleToggle}
          loading={loadingPerms}
        />

        {/* Tab Navigation */}
        <div className="tabs-bar">
          <button
            className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            📅 Timeline
          </button>
          <button
            className={`tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('audit');
              fetchAuditLogs();
            }}
          >
            📋 Audit Log <span className="pill-count">{totalAuditLogs}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'verifier' ? 'active' : ''}`}
            onClick={() => setActiveTab('verifier')}
          >
            🔬 Direct API Verifier
          </button>
          <button
            className="btn btn-primary btn-sm ml-auto"
            onClick={() => setIsModalOpen(true)}
          >
            ➕ New Event
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "timeline" && (
          <Timeline
            events={events}
            total={totalEvents}
            page={page}
            limit={limit}
            hasMore={hasMore}
            currentFilter={currentFilter}
            onFilterChange={handleFilterChange}
            onPageChange={handlePageChange}
            onDelete={handleDeleteEvent}
            permissions={permissions}
            loading={loadingEvents}
          />
        )}

        {activeTab === "audit" && (
          <AuditLog
            auditLogs={auditLogs}
            total={totalAuditLogs}
            onRefresh={fetchAuditLogs}
            loading={loadingAudit}
          />
        )}

        {activeTab === "verifier" && (
          <DirectVerifier
            knownEvents={knownEvents}
            onProbeSuccess={fetchAuditLogs}
          />
        )}
      </main>

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateEvent}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className="toast"
          style={{ background: toast.type === 'error' ? '#dc2626' : '#0f172a' }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// Mount React Root
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
