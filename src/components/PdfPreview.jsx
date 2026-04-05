export default function PdfPreview({ onNext, onBack }) {
  return (
    <div className="panel glass-card">
      <div className="empty-state">
        <div className="empty-state-icon">📄</div>
        <h2 className="empty-state-title">Phase 6: PDF Generation</h2>
        <p className="empty-state-text">PDF assembly triggers and preview will be built here.</p>
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
          <button className="btn btn-primary" onClick={onNext}>Continue</button>
        </div>
      </div>
    </div>
  );
}
