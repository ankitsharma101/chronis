/**
 * Chronis - Privacy-Aware Memory Timeline Frontend
 */

let state = {
  userId: "user_demo",
  permissions: {
    conversation: true,
    location: true,
    physiological: true,
    note: true
  },
  currentFilter: "all",
  currentPage: 1,
  limit: 10,
  events: [],
  totalEvents: 0,
  hasMore: false,
  allKnownEvents: [] // for direct verifier dropdown
};

// Category Metadata
const categoryMeta = {
  conversation: { icon: "💬", badgeClass: "badge-conversation", name: "Conversation" },
  location: { icon: "📍", badgeClass: "badge-location", name: "Location" },
  physiological: { icon: "💓", badgeClass: "badge-physiological", name: "Physiological" },
  note: { icon: "📝", badgeClass: "badge-note", name: "Note" }
};

// On DOM Loaded
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

async function initApp() {
  await loadPermissions();
  await loadEvents();
  await loadAuditLogs();
}

/**
 * Privacy Controls Management
 */
async function loadPermissions() {
  try {
    const res = await fetch("/permissions", {
      headers: { "X-User-Id": state.userId }
    });
    if (!res.ok) throw new Error("Failed to load permissions");
    const data = await res.json();
    state.permissions = data.permissions;
    updatePrivacyUI();
  } catch (err) {
    showToast("Error loading privacy permissions", "error");
    console.error(err);
  }
}

function updatePrivacyUI() {
  const disabledCategories = [];

  for (const [cat, enabled] of Object.entries(state.permissions)) {
    const toggle = document.getElementById(`toggle-${cat}`);
    const item = document.getElementById(`item-${cat}`);
    if (toggle) toggle.checked = enabled;
    if (item) {
      if (!enabled) {
        item.classList.add("disabled");
        disabledCategories.push(cat.charAt(0).toUpperCase() + cat.slice(1));
      } else {
        item.classList.remove("disabled");
      }
    }
  }

  // Warning banner & overall status badge
  const banner = document.getElementById("privacy-warning-banner");
  const badge = document.getElementById("privacy-status-badge");
  const listEl = document.getElementById("disabled-categories-list");

  if (disabledCategories.length > 0) {
    banner.classList.remove("hidden");
    listEl.textContent = disabledCategories.join(", ") + " (OFF)";
    badge.textContent = `${disabledCategories.length} Restricted`;
    badge.className = "badge badge-denied";
  } else {
    banner.classList.add("hidden");
    badge.textContent = "All Categories Active";
    badge.className = "badge badge-success";
  }
}

async function togglePermission(category, isEnabled) {
  try {
    const payload = {};
    payload[category] = isEnabled;

    const res = await fetch("/permissions", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": state.userId
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("Failed to update permission");

    const data = await res.json();
    state.permissions = data.permissions;
    updatePrivacyUI();

    showToast(`Privacy updated: ${category.toUpperCase()} is now ${isEnabled ? "ON" : "OFF"}`);

    // Re-fetch timeline from backend to reflect permission change immediately
    await loadEvents();
    await loadAuditLogs();
  } catch (err) {
    showToast("Failed to update permission", "error");
    console.error(err);
    // revert checkbox
    const toggle = document.getElementById(`toggle-${category}`);
    if (toggle) toggle.checked = !isEnabled;
  }
}

/**
 * Timeline & Events Management
 */
async function loadEvents() {
  const container = document.getElementById("timeline-container");
  container.innerHTML = '<div class="loading-state">Loading timeline events...</div>';

  let url = `/events?page=${state.currentPage}&limit=${state.limit}`;
  if (state.currentFilter !== "all") {
    url += `&type=${state.currentFilter}`;
  }

  try {
    const res = await fetch(url, {
      headers: { "X-User-Id": state.userId }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch events`);
    }

    const data = await res.json();
    state.events = data.events;
    state.totalEvents = data.total;
    state.hasMore = data.has_more;

    // Keep track of all known events for the verifier probe
    data.events.forEach(e => {
      if (!state.allKnownEvents.find(k => k.id === e.id)) {
        state.allKnownEvents.push(e);
      }
    });
    updateVerifierDropdown();

    renderTimeline();
    updatePaginationUI();
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error loading events: ${err.message}</div>`;
    console.error(err);
  }
}

function renderTimeline() {
  const container = document.getElementById("timeline-container");
  if (!state.events || state.events.length === 0) {
    let emptyMsg = "No events found.";
    if (state.currentFilter !== "all" && !state.permissions[state.currentFilter]) {
      emptyMsg = `Category '${state.currentFilter}' is turned OFF in Privacy Controls. Backend blocked all records.`;
    }
    container.innerHTML = `<div class="empty-state">⏳ ${emptyMsg}</div>`;
    return;
  }

  let html = "";
  state.events.forEach(event => {
    const meta = categoryMeta[event.type] || { icon: "📌", badgeClass: "badge-secondary", name: event.type };
    const dateFormatted = formatTimestamp(event.timestamp);

    html += `
      <div class="timeline-item" id="event-row-${event.id}">
        <div class="timeline-marker">${meta.icon}</div>
        <div class="timeline-card">
          <div class="event-top">
            <h4 class="event-title">${escapeHtml(event.title)}</h4>
            <div class="event-badges">
              <span class="badge ${meta.badgeClass}">${meta.icon} ${meta.name}</span>
            </div>
          </div>
          <div class="event-content">${escapeHtml(event.content)}</div>
          <div class="event-meta">
            <div class="event-time">
              <span>🕒</span>
              <span>${dateFormatted}</span>
            </div>
            <div class="event-actions">
              <button class="btn btn-danger-outline" onclick="deleteEvent('${event.id}', '${escapeHtml(event.title)}')">🗑️ Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function updatePaginationUI() {
  const prevBtn = document.getElementById("prev-page-btn");
  const nextBtn = document.getElementById("next-page-btn");
  const pageIndicator = document.getElementById("page-indicator");
  const summaryEl = document.getElementById("page-summary");

  const startIdx = state.totalEvents === 0 ? 0 : (state.currentPage - 1) * state.limit + 1;
  const endIdx = Math.min(state.currentPage * state.limit, state.totalEvents);

  summaryEl.textContent = `Showing ${startIdx}-${endIdx} of ${state.totalEvents}`;
  pageIndicator.textContent = `Page ${state.currentPage}`;

  prevBtn.disabled = state.currentPage <= 1;
  nextBtn.disabled = !state.hasMore;
}

function changePage(delta) {
  state.currentPage = Math.max(1, state.currentPage + delta);
  loadEvents();
}

function applyTypeFilter(type) {
  state.currentFilter = type;
  state.currentPage = 1;

  document.querySelectorAll(".filter-chip").forEach(chip => {
    if (chip.getAttribute("data-type") === type) {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });

  loadEvents();
}

async function deleteEvent(id, title) {
  if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

  try {
    const res = await fetch(`/events/${id}`, {
      method: "DELETE",
      headers: { "X-User-Id": state.userId }
    });

    if (!res.ok) throw new Error("Failed to delete event");

    showToast("Event deleted successfully");
    await loadEvents();
    await loadAuditLogs();
  } catch (err) {
    showToast("Error deleting event", "error");
    console.error(err);
  }
}

/**
 * Event Creation Modal
 */
function openCreateModal() {
  document.getElementById("create-modal").classList.remove("hidden");
  document.getElementById("event-title").focus();
}

function closeCreateModal() {
  document.getElementById("create-modal").classList.add("hidden");
  document.getElementById("create-event-form").reset();
}

async function handleCreateEvent(e) {
  e.preventDefault();
  const submitBtn = document.getElementById("create-submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  const type = document.getElementById("event-type").value;
  const title = document.getElementById("event-title").value.trim();
  const content = document.getElementById("event-content").value.trim();
  const timeInput = document.getElementById("event-time").value;

  const payload = {
    type,
    title,
    content
  };

  if (timeInput) {
    payload.timestamp = new Date(timeInput).toISOString();
  }

  try {
    const res = await fetch("/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": state.userId
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Failed to create event");
    }

    const created = await res.json();
    state.allKnownEvents.push(created);
    updateVerifierDropdown();

    closeCreateModal();
    showToast("Event created successfully!");

    await loadEvents();
    await loadAuditLogs();
  } catch (err) {
    alert("Error: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Event";
  }
}

/**
 * Audit Log Management
 */
async function loadAuditLogs() {
  try {
    const res = await fetch("/audit-log?limit=50", {
      headers: { "X-User-Id": state.userId }
    });
    if (!res.ok) throw new Error("Failed to load audit logs");

    const data = await res.json();
    const tbody = document.getElementById("audit-log-tbody");
    const countBadge = document.getElementById("audit-count-badge");

    countBadge.textContent = data.total;

    if (!data.audit_logs || data.audit_logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No audit records found.</td></tr>';
      return;
    }

    let rowsHtml = "";
    data.audit_logs.forEach(log => {
      let resultBadge = "badge-success";
      if (log.result === "DENIED") resultBadge = "badge-denied";
      else if (log.result === "ERROR") resultBadge = "badge-error";

      rowsHtml += `
        <tr>
          <td><small>${formatTimestamp(log.timestamp)}</small></td>
          <td><strong>${escapeHtml(log.action)}</strong></td>
          <td>${log.event_type ? `<span class="badge ${categoryMeta[log.event_type]?.badgeClass || ''}">${escapeHtml(log.event_type)}</span>` : '<span class="text-muted">-</span>'}</td>
          <td><span class="badge ${resultBadge}">${escapeHtml(log.result)}</span></td>
          <td><small>${escapeHtml(log.details || "-")}</small></td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;
  } catch (err) {
    console.error("Audit log load error:", err);
  }
}

/**
 * Direct Backend Authorization Verifier (Tab 3)
 */
function updateVerifierDropdown() {
  const select = document.getElementById("verifier-event-select");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">Select an event to test direct API authorization...</option>';

  state.allKnownEvents.forEach(evt => {
    const opt = document.createElement("option");
    opt.value = evt.id;
    opt.textContent = `[${evt.type.toUpperCase()}] ${evt.title} (${evt.id.substring(0, 8)}...)`;
    select.appendChild(opt);
  });

  if (currentVal) select.value = currentVal;
}

async function probeSingleEvent() {
  const select = document.getElementById("verifier-event-select");
  const eventId = select.value;
  if (!eventId) {
    alert("Please select an event from the dropdown to test.");
    return;
  }

  const output = document.getElementById("verifier-output");
  const statusEl = document.getElementById("probe-status");
  const authEl = document.getElementById("probe-auth");
  const bodyEl = document.getElementById("probe-response-body");

  output.classList.remove("hidden");
  statusEl.textContent = "Probing...";
  authEl.textContent = "...";
  bodyEl.textContent = "Sending GET /events/" + eventId;

  try {
    const res = await fetch(`/events/${eventId}`, {
      headers: { "X-User-Id": state.userId }
    });

    const statusText = `${res.status} ${res.statusText}`;
    statusEl.textContent = statusText;

    const json = await res.json();
    bodyEl.textContent = JSON.stringify(json, null, 2);

    if (res.status === 403) {
      statusEl.style.color = "#ef4444";
      authEl.textContent = "🛑 ACCESS BLOCKED BY PRIVACY POLICY (403 FORBIDDEN)";
      authEl.style.color = "#ef4444";
      showToast("Privacy Engine Blocked Request (403)", "error");
    } else if (res.ok) {
      statusEl.style.color = "#10b981";
      authEl.textContent = "✅ ACCESS ALLOWED (CATEGORY IS ON)";
      authEl.style.color = "#10b981";
    } else {
      statusEl.style.color = "#f59e0b";
      authEl.textContent = "⚠️ Response Code: " + res.status;
      authEl.style.color = "#f59e0b";
    }

    // Refresh audit log tab to show the ALLOWED or DENIED entry created
    await loadAuditLogs();
  } catch (err) {
    statusEl.textContent = "Network Error";
    bodyEl.textContent = err.message;
  }
}

/**
 * Tab Navigation
 */
function switchTab(tabName) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));

  if (tabName === "timeline") {
    document.getElementById("tab-timeline").classList.add("active");
    document.getElementById("tab-timeline-btn").classList.add("active");
  } else if (tabName === "audit") {
    document.getElementById("tab-audit").classList.add("active");
    document.getElementById("tab-audit-btn").classList.add("active");
    loadAuditLogs();
  } else if (tabName === "test") {
    document.getElementById("tab-test").classList.add("active");
    document.getElementById("tab-test-btn").classList.add("active");
    updateVerifierDropdown();
  }
}

/**
 * Helpers
 */
function formatTimestamp(isoStr) {
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
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let toastTimer = null;
function showToast(msg, type = "info") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  if (type === "error") {
    toast.style.background = "#dc2626";
  } else {
    toast.style.background = "#0f172a";
  }

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3200);
}
