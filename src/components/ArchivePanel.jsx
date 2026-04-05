import { useState, useEffect } from 'react';
import { api } from '../utils/api';

function StatusBadge({ financialStatus, fulfillmentStatus }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {financialStatus === 'paid' && (
        <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded border border-green-500/25 uppercase tracking-widest font-bold">Paid</span>
      )}
      {financialStatus === 'pending' && (
        <span className="text-[10px] bg-yellow-500/15 text-yellow-400 px-2 py-0.5 rounded border border-yellow-500/25 uppercase tracking-widest font-bold">Pending</span>
      )}
      {financialStatus === 'partially_paid' && (
        <span className="text-[10px] bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded border border-orange-500/25 uppercase tracking-widest font-bold">Part. Paid</span>
      )}
      {fulfillmentStatus === 'fulfilled' && (
        <span className="text-[10px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded border border-blue-500/25 uppercase tracking-widest font-bold">Shipped</span>
      )}
    </div>
  );
}

function ClientModal({ order, onClose }) {
  const [selectedAlbum, setSelectedAlbum] = useState(order.results?.[0] || null);

  const handleZipDownload = async (res) => {
    try {
      const response = await fetch('http://localhost:3001/api/generate/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverUrl: res.coverUrl,
          interiorUrl: res.interiorUrl,
          orderId: order.orderNumber,
          clientName: `${order.firstName} ${order.lastName}`,
          albumName: res.albumName
        })
      });
      if (!response.ok) throw new Error('ZIP API failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${order.orderNumber}_${order.firstName}_${order.lastName}_${res.albumName}.zip`.replace(/[^a-z0-9._-]/gi, '_');
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert('Failed to package zip: ' + err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-0 animate-fade-in"
        style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-white/10 bg-black/30">
          <div>
            <h2 className="text-2xl font-bold mb-1">{order.firstName} {order.lastName}</h2>
            <div className="flex items-center gap-3 text-sm text-muted">
              <span>Order <strong className="text-accent">#{order.orderNumber}</strong></span>
              <span>•</span>
              <span>📅 {new Date(order.processedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span>•</span>
              <span>✉️ {order.email}</span>
            </div>
            <div className="mt-3 flex gap-2 items-center">
              <StatusBadge financialStatus={order.financialStatus} fulfillmentStatus={order.fulfillmentStatus} />
              <span className={`badge text-[10px] ${order.tier === 'Trio' ? 'badge-info' : order.tier === 'Duo' ? 'badge-warning' : 'badge-success'}`}>{order.tier}</span>
              <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded border border-accent/30 uppercase tracking-widest font-bold">✅ Generated</span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors text-2xl leading-none p-1">✕</button>
        </div>

        <div className="flex flex-col md:flex-row h-full">
          {/* Album Selector sidebar */}
          <div className="md:w-52 border-b md:border-b-0 md:border-r border-white/10 p-4 flex-shrink-0">
            <div className="text-[10px] uppercase tracking-widest text-muted font-bold mb-3">Albums</div>
            <div className="flex flex-col gap-2">
              {order.results?.map((res, i) => (
                <button
                  key={i}
                  className={`text-left px-3 py-2.5 rounded text-sm transition-colors ${selectedAlbum?.albumName === res.albumName ? 'bg-accent/20 text-accent border border-accent/40 font-bold' : 'text-muted hover:text-white hover:bg-white/5 border border-transparent'}`}
                  onClick={() => setSelectedAlbum(res)}
                >
                  📖 {res.albumName}
                </button>
              ))}
            </div>
          </div>

          {/* PDF Preview area */}
          {selectedAlbum && (
            <div className="flex-1 p-6">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="font-bold text-lg">{selectedAlbum.albumName}</h3>
                  <p className="text-xs text-muted">A4 Hardcover Print Package</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleZipDownload(selectedAlbum)} className="btn btn-primary btn-sm flex items-center gap-2">
                    📦 Download ZIP
                  </button>
                  <a href={selectedAlbum.coverUrl} download target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Cover PDF</a>
                  <a href={selectedAlbum.interiorUrl} download target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">Interior PDF</a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted uppercase tracking-widest font-bold mb-2">Cover (Spine + Front)</div>
                  <iframe
                    src={selectedAlbum.coverUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'}
                    className="w-full rounded border border-white/10"
                    style={{ height: '380px' }}
                    title="Cover Preview"
                  />
                </div>
                <div>
                  <div className="text-xs text-muted uppercase tracking-widest font-bold mb-2">Interior Pages</div>
                  <iframe
                    src={selectedAlbum.interiorUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'}
                    className="w-full rounded border border-white/10"
                    style={{ height: '380px' }}
                    title="Interior Preview"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ArchivePanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterPaid, setFilterPaid] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchArchives();
  }, []);

  const fetchArchives = async () => {
    setLoading(true);
    try {
      const data = await api.shopify.getOrders();
      const archived = (data || []).filter(o => o.hasGeneratedPdf === true);
      setOrders(archived);
      setError(null);
    } catch (err) {
      setError('Failed to load archives.');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const nameMatch = order.orderNumber.toString().includes(search) ||
      `${order.firstName} ${order.lastName}`.toLowerCase().includes(search.toLowerCase());
    const paidMatch = !filterPaid || order.financialStatus === 'paid';
    return nameMatch && paidMatch;
  });

  return (
    <div className="order-panel-container animate-fade-in">
      {selectedOrder && (
        <ClientModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}

      <div className="section-header">
        <div>
          <h2 className="section-title">🗄️ PDF Archive Library</h2>
          <p className="section-subtitle">
            {loading ? 'Loading...' : `${orders.length} generated client album${orders.length !== 1 ? 's' : ''} on file`}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchArchives} disabled={loading}>
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3 mb-8 items-center">
        <div className="login-input-wrapper flex-1">
          <span className="login-input-icon">🔍</span>
          <input
            type="text"
            className="input"
            placeholder="Search by Order # or Client Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm text-muted hover:text-white transition-colors select-none">
          <input
            type="checkbox"
            className="w-4 h-4 accent-cyan-500"
            checked={filterPaid}
            onChange={e => setFilterPaid(e.target.checked)}
          />
          Paid only
        </label>
      </div>

      {error && <div className="login-error mb-4">{error}</div>}

      {loading ? (
        <div className="empty-state">
          <div className="spinner spinner-lg mb-4"></div>
          <p>Loading generated archives...</p>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid-2">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className="order-card glass-card cursor-pointer hover:border-accent/50 transition-colors"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="order-card-header">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="order-number">#{order.orderNumber}</span>
                  <StatusBadge financialStatus={order.financialStatus} fulfillmentStatus={order.fulfillmentStatus} />
                </div>
                <span className={`badge ${order.tier === 'Trio' ? 'badge-info' : order.tier === 'Duo' ? 'badge-warning' : 'badge-success'}`}>
                  {order.tier}
                </span>
              </div>

              <div className="order-card-body">
                <h3 className="client-name">{order.firstName} {order.lastName}</h3>
                <div className="order-meta">
                  <span>📅 {new Date(order.processedAt).toLocaleDateString()}</span>
                  <span>✉️ {order.email}</span>
                </div>
              </div>

              <div className="order-card-footer">
                <div className="line-items-summary w-full flex justify-between items-center">
                  <span>{order.results?.length} album{order.results?.length !== 1 ? 's' : ''} generated</span>
                  <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded border border-accent/30 uppercase tracking-widest font-bold">
                    ✅ Ready to Print
                  </span>
                </div>

                <div className="w-full mt-3 pt-3 border-t border-white/5 text-xs text-muted">
                  {order.results?.map((res, i) => (
                    <span key={i} className="inline-flex items-center gap-1 mr-3 mb-1">
                      📖 {res.albumName}
                    </span>
                  ))}
                </div>

                <div className="w-full mt-2 text-center">
                  <span className="text-[10px] text-muted italic opacity-60">Click to view details & download</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">🗄️</div>
          <p className="empty-state-title">No Archives Found</p>
          <p className="empty-state-text">
            {search || filterPaid
              ? 'No results match your current filters.'
              : "You haven't generated any PDFs yet. Complete an order workflow to see it here."}
          </p>
        </div>
      )}
    </div>
  );
}
