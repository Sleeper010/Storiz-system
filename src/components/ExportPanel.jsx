export default function ExportPanel({ onBack }) {
  return (
    <div className="panel glass-card">
      <div className="empty-state">
        <div className="empty-state-icon">⬇️</div>
        <h2 className="empty-state-title">Phase 7: Export</h2>
        <p className="empty-state-text">Download links and ZIP export will be built here.</p>
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
        </div>
      </div>
    </div>
  );
}
