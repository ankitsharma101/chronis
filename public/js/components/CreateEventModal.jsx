// Create Event Modal React Component
function CreateEventModal({ isOpen, onClose, onCreate }) {
  const [type, setType] = React.useState("conversation");
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [timestamp, setTimestamp] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setSubmitting(true);
    const payload = {
      type,
      title: title.trim(),
      content: content.trim()
    };
    if (timestamp) {
      payload.timestamp = new Date(timestamp).toISOString();
    }

    try {
      await onCreate(payload);
      setTitle("");
      setContent("");
      setTimestamp("");
      onClose();
    } catch (err) {
      alert("Failed to create event: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-dialog">
        <div className="modal-header">
          <h3>Create New Memory Event</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="evt-type">Category *</label>
            <select
              id="evt-type"
              className="form-control"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="conversation">💬 Conversation</option>
              <option value="location">📍 Location</option>
              <option value="physiological">💓 Physiological</option>
              <option value="note">📝 Note</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="evt-title">Title *</label>
            <input
              type="text"
              id="evt-title"
              className="form-control"
              placeholder="e.g. Morning meeting with team"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={255}
            />
          </div>

          <div className="form-group">
            <label htmlFor="evt-content">Content *</label>
            <textarea
              id="evt-content"
              className="form-control"
              rows={3}
              placeholder="Describe the memory event..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            ></textarea>
          </div>

          <div className="form-group">
            <label htmlFor="evt-time">Timestamp (Optional - defaults to current time)</label>
            <input
              type="datetime-local"
              id="evt-time"
              className="form-control"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

window.CreateEventModal = CreateEventModal;
