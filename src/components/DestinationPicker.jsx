import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import DesignImporter from './DesignImporter';

export default function DestinationPicker({ onSelect }) {
  const [destinations, setDestinations] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showImporter, setShowImporter] = useState(false);
  const [search,       setSearch]       = useState('');
  const [error,        setError]        = useState(null);
  const [deleting,     setDeleting]     = useState(null); // id being deleted
  const [confirmDel,   setConfirmDel]   = useState(null); // id awaiting confirm
  const [droppedFile,  setDroppedFile]  = useState(null);
  const [isDragging,   setIsDragging]   = useState(false);

  useEffect(() => {
    fetchDestinations();
  }, []);

  const fetchDestinations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.destinations.list();
      setDestinations(data || []);
    } catch (err) {
      setError('Could not load destinations. Please check your Supabase connection.');
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation(); // don't select the destination
    
    if (!window.confirm("Are you sure you want to remove this design? This action cannot be undone.")) {
      return;
    }
    
    setDeleting(id);
    try {
      await api.destinations.delete(id);
      setDestinations(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  // Reset confirm state when clicking away
  const handleCardClick = (dest) => {
    onSelect(dest);
  };

  const searchTerms = search.trim().toLowerCase().split(/\s+/);
  const filtered = destinations.filter(d => {
    if (!search.trim()) return true;
    const name = (d?.name || '').toLowerCase();
    return searchTerms.every(t => name.includes(t));
  });

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        setDroppedFile(file);
        setShowImporter(true);
      } else {
        alert('Please drop a PDF file to import cover designs.');
      }
    }
  };

  if (showImporter) {
    return (
      <DesignImporter
        initialFile={droppedFile}
        onComplete={() => { setShowImporter(false); setDroppedFile(null); fetchDestinations(); }}
      />
    );
  }

  return (
    <div 
      className={`destination-picker-container animate-fade-in relative transition-all ${isDragging ? 'ring-4 ring-accent-primary ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-bg-dark/80 backdrop-blur-sm flex items-center justify-center rounded-lg pointer-events-none">
          <div className="text-center text-accent-primary animate-pulse">
            <div className="text-6xl mb-4">📥</div>
            <h3 className="text-2xl font-bold">Drop PDF to Import</h3>
          </div>
        </div>
      )}
      <div className="section-header">
        <div>
          <h2 className="section-title">Select Destination</h2>
          <p className="section-subtitle">Choose the cover design for this album</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowImporter(true)}>
          ➕ Import Design
        </button>
      </div>

      <div className="search-bar-wrapper mb-4">
        <div className="login-input-wrapper">
          <span className="login-input-icon">🔍</span>
          <input
            type="text"
            className="input"
            placeholder="Search destination (e.g. Switzerland)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="destination-list destination-list-scrollable">
        {error ? (
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <p className="empty-state-title">Connection Error</p>
            <p className="empty-state-text">{error}</p>
            <button className="btn btn-primary mt-4" onClick={fetchDestinations}>Retry</button>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <div className="spinner spinner-lg" />
            <p className="mt-4">Loading destination library…</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid-3 gap-6">
            {filtered.map(dest => (
              <div
                key={dest.id}
                className="destination-card glass-card p-4 pointer relative group"
                onClick={() => handleCardClick(dest)}
              >
                {/* Delete button */}
                <button
                  className={`destination-card-delete ${deleting === dest.id ? 'deleting' : ''}`}
                  onClick={e => handleDelete(dest.id, e)}
                  disabled={deleting === dest.id}
                  title="Remove design"
                >
                  {deleting === dest.id ? '…' : '✕'}
                </button>

                <div className="destination-preview" style={{ background: dest.background_color || '#000033' }}>
                  {dest.thumbnail_url || dest.cover_url ? (
                    <img
                      src={dest.thumbnail_url || dest.cover_url}
                      alt={dest.name}
                      className="destination-thumb-img"
                      loading="lazy"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ) : null}
                  <div className="destination-name-overlay">{dest.name}</div>
                </div>

                <div className="mt-3 flex justify-between items-center">
                  <span className="font-bold text-sm">{dest.name}</span>
                  <div
                    className="color-swatch"
                    style={{ background: dest.background_color, width: 16, height: 16, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🗺️</div>
            <p className="empty-state-title">No destinations found</p>
            <p className="empty-state-text">
              {search ? 'Try a different search term.' : 'Import a cover design PDF to get started.'}
            </p>
            <button className="btn btn-primary mt-4" onClick={() => setShowImporter(true)}>
              Import First Design
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
