import { useState, useEffect } from 'react';
import { api } from '../utils/api';

export default function OrderPanel({ onOrderSelect }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await api.shopify.getOrders();
      setOrders(data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load orders from Shopify.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => 
    order.orderNumber.toString().includes(search) || 
    `${order.firstName} ${order.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (order) => {
    setSelectedOrderId(order.id);
    onOrderSelect(order);
  };

  const handleZipDownload = async (e, order, res) => {
    e.stopPropagation(); // prevent accidentally opening the config
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
    <div className="order-panel-container animate-fade-in">
      <div className="section-header">
        <div>
          <h2 className="section-title">Select Shopify Order</h2>
          <p className="section-subtitle">Choose an order to start building a photo album</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchOrders} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh List'}
        </button>
      </div>

      <div className="search-bar-wrapper mb-4">
        <div className="login-input-wrapper">
          <span className="login-input-icon">🔍</span>
          <input
            type="text"
            className="input"
            placeholder="Search by Order # or Client Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="login-error mb-4">{error}</div>}

      <div className="order-list">
        {loading ? (
          <div className="empty-state">
            <div className="spinner spinner-lg mb-4"></div>
            <p>Fetching latest orders from Shopify...</p>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="grid-2">
            {filteredOrders.map(order => (
              <div 
                key={order.id} 
                className={`order-card glass-card ${selectedOrderId === order.id ? 'selected' : ''}`}
                onClick={() => handleSelect(order)}
              >
                <div className="order-card-header">
                  <div className="flex items-center gap-2">
                    <span className="order-number">#{order.orderNumber}</span>
                    {order.financialStatus === 'paid' && <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded border border-green-500/20 uppercase tracking-widest font-bold">Paid</span>}
                    {order.financialStatus === 'pending' && <span className="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/20 uppercase tracking-widest font-bold">Pending</span>}
                    {order.fulfillmentStatus === 'fulfilled' && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest font-bold">Shipped</span>}
                    {order.hasGeneratedPdf && <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded border border-accent/30 uppercase tracking-widest font-bold">✅ Generated</span>}
                  </div>
                  <span className={`badge ${
                    order.tier === 'Trio' ? 'badge-info' : 
                    order.tier === 'Duo' ? 'badge-warning' : 'badge-success'
                  }`}>
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
                <div className="order-card-footer flex flex-col items-start w-full">
                  <div className="line-items-summary w-full flex justify-between">
                    <span>{order.lineItems.length} items • {order.currency} {order.totalPrice}</span>
                  </div>
                  {order.hasGeneratedPdf && (
                    <div className="w-full mt-3 p-3 bg-black/20 rounded border border-white/5" onClick={e => e.stopPropagation()}>
                      <div className="text-xs font-bold text-success mb-2 border-b border-white/10 pb-1">Archived PDFs Available:</div>
                      {order.results?.map((res, i) => (
                        <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-white/5 last:border-0">
                          <span className="text-white font-semibold">{res.albumName}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => handleZipDownload(e, order, res)} className="bg-primary/50 hover:bg-primary px-2 py-1 rounded transition-colors flex items-center gap-1 border border-primary/50 text-[10px] uppercase font-bold tracking-wider mr-2 text-white">
                              📦 Zip
                            </button>
                            <a href={res.coverUrl} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-muted hover:text-accent transition-colors">Cover</a>
                            <a href={res.interiorUrl} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-muted hover:text-success transition-colors">Interior</a>
                          </div>
                        </div>
                      ))}
                      <div className="text-[10px] text-muted italic mt-2 text-center opacity-70">Click anywhere on the card to edit and regenerate</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🔎</div>
            <p className="empty-state-title">No orders found</p>
            <p className="empty-state-text">Try a different search term or refresh the list.</p>
          </div>
        )}
      </div>
    </div>
  );
}
