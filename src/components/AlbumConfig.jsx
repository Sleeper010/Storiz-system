import { useState, useEffect } from 'react';
import DestinationPicker from './DestinationPicker';
import { api } from '../utils/api';

// ── Pricing engine ────────────────────────────────────────────────────────────
const BASE_PRICES = { 1: 249, 2: 449, 3: 649 };
const EXTRA_100_PAGES = 80; // per album for 100-page upgrade

function calcPrice(albums) {
  const count = albums.length;
  const base  = count >= 3 ? 649 : count === 2 ? 449 : 249;
  const extra = albums.filter(a => (a.pageCount || 60) === 100).length * EXTRA_100_PAGES;
  return base + extra;
}

export default function AlbumConfig({ order, onComplete, onBack }) {
  const [config, setConfig] = useState({
    clientName:  `${order?.firstName || ''} ${order?.lastName || ''}`.trim(),
    orderNumber: order?.orderNumber || '',
    tier:        order?.tier || 'Solo',
    albums:      [],
  });

  // Derive initial album count from tier
  const defaultAlbumCount = config.tier === 'Trio' ? 3 : config.tier === 'Duo' ? 2 : 1;

  // Auto-initialise albums once on mount
  useEffect(() => {
    if (config.albums.length > 0) return;

    async function initAlbums() {
      let destinations = [];
      try { destinations = await api.destinations.list(); } catch (_) {}

      let cleanStr = JSON.stringify(order).toLowerCase().replace(/[^a-z0-9]/g, '');
      const matched = [];
      const sorted  = [...destinations].sort((a, b) => b.name.length - a.name.length);

      for (const dest of sorted) {
        const key = dest.name.toLowerCase().replace(/\s+\d+$/, '').replace(/[^a-z0-9]/g, '');
        if (key.length > 2 && cleanStr.includes(key)) {
          matched.push(dest);
          cleanStr = cleanStr.replace(key, '');
        }
      }

      const initial = Array.from({ length: defaultAlbumCount }, (_, i) => ({
        id:          i,
        destination: matched[i] || null,
        year:        new Date().getFullYear().toString(),
        pageCount:   60,
      }));

      setConfig(prev => ({ ...prev, albums: initial }));
    }

    initAlbums();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Album mutations ─────────────────────────────────────────────────────────
  const updateAlbum = (idx, updates) =>
    setConfig(prev => ({
      ...prev,
      albums: prev.albums.map((a, i) => (i === idx ? { ...a, ...updates } : a)),
    }));

  const addAlbum = () => {
    const nextId = config.albums.length;
    setConfig(prev => ({
      ...prev,
      albums: [...prev.albums, { id: nextId, destination: null, year: new Date().getFullYear().toString(), pageCount: 60 }],
    }));
  };

  const removeAlbum = (idx) => {
    if (config.albums.length <= 1) return;
    setConfig(prev => ({
      ...prev,
      albums: prev.albums
        .filter((_, i) => i !== idx)
        .map((a, i) => ({ ...a, id: i })),
    }));
  };

  const handleContinue = () => {
    const missing = config.albums.find(a => !a.destination);
    if (missing) {
      alert(`Please select a destination for Album ${missing.id + 1}`);
      return;
    }
    onComplete(config);
  };

  const totalPrice = calcPrice(config.albums);

  return (
    <div className="album-config-container animate-fade-in">

      {/* ── Client info ──────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 mb-6">
        <h2 className="section-title mb-5">Order Details</h2>
        <div className="grid-2 gap-6">
          <div className="input-group">
            <label className="label">Client Name</label>
            <input type="text" className="input"
              value={config.clientName}
              onChange={e => setConfig({ ...config, clientName: e.target.value })} />
          </div>
          <div className="input-group">
            <label className="label">Order Number</label>
            <input type="text" className="input"
              value={config.orderNumber}
              onChange={e => setConfig({ ...config, orderNumber: e.target.value })} />
          </div>
        </div>
      </div>

      {/* ── Pricing banner ───────────────────────────────────────────────────── */}
      <div className="pricing-banner glass-card p-5 mb-6 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-1">Order Value</div>
          <div className="text-2xl font-bold text-accent">{totalPrice} <span className="text-sm text-muted font-normal">MAD</span></div>
        </div>
        <div className="text-right text-xs text-muted space-y-1">
          <div>{config.albums.length} album{config.albums.length !== 1 ? 's' : ''}</div>
          {config.albums.filter(a => a.pageCount === 100).length > 0 && (
            <div>+{config.albums.filter(a => a.pageCount === 100).length} × 100-page upgrade (+{config.albums.filter(a => a.pageCount === 100).length * EXTRA_100_PAGES} MAD)</div>
          )}
        </div>
        <button className="btn btn-primary btn-sm flex items-center gap-2" onClick={addAlbum}>
          ＋ Add Album
        </button>
      </div>

      {/* ── Album slots ──────────────────────────────────────────────────────── */}
      <div className="album-slots-container">
        {config.albums.map((album, index) => (
          <div key={album.id} className="album-slot glass-card p-6 mb-5">
            <div className="slot-header flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold text-sm">
                  {index + 1}
                </div>
                <h3 className="text-lg font-bold">
                  {album.destination
                    ? album.destination.name.replace(/\s+\d+$/, '')
                    : `Album ${index + 1}`}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${album.pageCount === 100 ? 'badge-warning' : 'badge-primary'}`}>
                  {album.pageCount}p
                </span>
                {config.albums.length > 1 && (
                  <button onClick={() => removeAlbum(index)} className="btn btn-danger btn-sm">Remove</button>
                )}
              </div>
            </div>

            <div className="grid-2 gap-8">
              {/* Destination picker */}
              <div className="destination-selection">
                <label className="label mb-3">Cover Design</label>
                {album.destination ? (
                  <div className="selected-destination-card glass-card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="color-swatch-lg" style={{ background: album.destination.background_color }} />
                      <div>
                        <div className="font-bold">{album.destination.name.replace(/\s+\d+$/, '')}</div>
                        <div className="text-xs text-muted">Design loaded ✓</div>
                      </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => updateAlbum(index, { destination: null })}>Change</button>
                  </div>
                ) : (
                  <DestinationPicker onSelect={dest => updateAlbum(index, { destination: dest })} />
                )}
              </div>

              {/* Options */}
              <div className="options-selection flex flex-col gap-5">
                <div className="input-group">
                  <label className="label">Custom Print Name <span className="text-muted text-xs">(optional, overrides client name on first page)</span></label>
                  <input type="text" className="input" placeholder="e.g. Baby Liam" value={album.customName || ''}
                    onChange={e => updateAlbum(index, { customName: e.target.value })} />
                </div>

                <div className="input-group">
                  <label className="label">Trip Year <span className="text-muted text-xs">(appears on cover & spine)</span></label>
                  <input type="text" className="input" value={album.year}
                    onChange={e => updateAlbum(index, { year: e.target.value })} />
                </div>

                <div className="input-group">
                  <label className="label">Page Count</label>
                  <div className="flex gap-3 mt-1">
                    {[60, 100].map(pages => (
                      <button key={pages}
                        className={`page-count-btn flex-1 py-3 rounded-lg border transition-all text-sm font-bold ${album.pageCount === pages ? 'border-accent bg-accent/15 text-accent' : 'border-white/10 text-muted hover:border-white/30'}`}
                        onClick={() => updateAlbum(index, { pageCount: pages })}
                      >
                        {pages} pages
                        {pages === 100 && <div className="text-[10px] font-normal text-muted mt-0.5">+80 MAD</div>}
                        {pages === 60  && <div className="text-[10px] font-normal text-muted mt-0.5">Base</div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="input-group">
                  <label className="label">Photo Layout</label>
                  <select className="input" value={album.layout || 'grid'}
                    onChange={e => updateAlbum(index, { layout: e.target.value })}>
                    <option value="single">Single photo per page</option>
                    <option value="grid">Random organigram grid (recommended)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────────── */}
      <div className="step-actions flex justify-between items-center mt-8">
        <button className="btn btn-secondary" onClick={onBack}>← Back to Orders</button>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted">Total: <strong className="text-accent">{totalPrice} MAD</strong></div>
          <button className="btn btn-primary btn-lg" onClick={handleContinue}>
            Continue to Photos →
          </button>
        </div>
      </div>
    </div>
  );
}
