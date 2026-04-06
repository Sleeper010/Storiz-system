import { useState } from 'react';
import { api } from '../utils/api';

export default function ManualOrderForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    client_name: '',
    email: '',
    phone: '',
    tier: 'Solo',
    albumCount: 1,
    pageCount: 60
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const albumsConfig = Array.from({ length: formData.albumCount }).map(() => ({
        page_count: formData.pageCount,
        layout: 'grid'
      }));

      const newOrder = await api.orders.create({
        order: {
          client_name: formData.client_name,
          email: formData.email,
          phone: formData.phone,
          tier: formData.tier
        },
        albums: albumsConfig
      });
      
      onSuccess(newOrder);
    } catch (err) {
      setError(err.message || 'Failed to create manual order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Create Manual Order</h2>
          <button onClick={onClose} className="text-muted hover:text-white">✕</button>
        </div>

        {error && <div className="login-error mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="input-group">
            <label className="label">Client Name *</label>
            <input 
              type="text" 
              className="input" 
              required 
              value={formData.client_name}
              onChange={e => setFormData({ ...formData, client_name: e.target.value })}
            />
          </div>
          
          <div className="grid-2 gap-4">
            <div className="input-group">
              <label className="label">Email Address</label>
              <input 
                type="email" 
                className="input" 
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label className="label">Phone Number</label>
              <input 
                type="tel" 
                className="input" 
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2 gap-4">
            <div className="input-group">
              <label className="label">Package Tier</label>
              <select 
                className="input"
                value={formData.tier}
                onChange={e => {
                  const tier = e.target.value;
                  const count = tier === 'Trio' ? 3 : tier === 'Duo' ? 2 : 1;
                  setFormData({ ...formData, tier, albumCount: count });
                }}
              >
                <option value="Solo">Solo (1 Album)</option>
                <option value="Duo">Duo (2 Albums)</option>
                <option value="Trio">Trio (3 Albums)</option>
              </select>
            </div>
            <div className="input-group">
              <label className="label">Pages per Album</label>
              <select 
                className="input"
                value={formData.pageCount}
                onChange={e => setFormData({ ...formData, pageCount: parseInt(e.target.value) })}
              >
                <option value={60}>60 Pages</option>
                <option value={100}>100 Pages (+80 MAD)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-white/10">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Order & Init Albums'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
