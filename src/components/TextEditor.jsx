import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const DEFAULT_TEXT_TARGETS = [
  { id: 'cover_spine_title', label: 'Spine Destination Title', type: 'text', maxLength: 30 },
  { id: 'cover_spine_year', label: 'Spine Year', type: 'text', maxLength: 10 },
  { id: 'interior_dest', label: 'First Page Destination Title', type: 'text', maxLength: 30 },
  { id: 'interior_year', label: 'First Page Year', type: 'text', maxLength: 20 },
  { id: 'interior_name', label: 'First Page Client/Print Name', type: 'text', maxLength: 50 },
  { id: 'interior_website', label: 'First Page Website URL', type: 'text', maxLength: 30 }
];

export default function TextEditor({ order, album, onComplete, onBack }) {
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTexts();
  }, [album.id]);

  const fetchTexts = async () => {
    setLoading(true);
    try {
      const data = await api.texts.get(album.id);
      if (data && data.length > 0) {
        setTexts(data);
      } else {
        // Init defaults if none
        const defaultData = await api.texts.generateDefaults(album.id, {
          orderContext: { clientName: order.firstName ? `${order.firstName} ${order.lastName}` : order.client_name },
          albumContext: {
            destination: album.destination_snapshot || album.destination,
            year: album.year,
            customName: album.customName || album.custom_name
          }
        });
        setTexts(defaultData);
      }
    } catch (err) {
      console.error('Failed to fetch texts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (targetId, content) => {
    setTexts(prev => {
      const active = prev.find(t => t.target === targetId);
      if (active) {
        return prev.map(t => t.target === targetId ? { ...t, content } : t);
      } else {
        return [...prev, { target: targetId, content, font_size: 36, text_align: 'center' }];
      }
    });
  };

  const saveTexts = async () => {
    setSaving(true);
    try {
      await api.texts.update(album.id, texts);
      onComplete(texts);
    } catch (err) {
      alert('Failed to save texts: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><div className="spinner mb-4"></div><p>Loading texts...</p></div>;

  return (
    <div className="text-editor animate-fade-in">
      <div className="flex justify-between items-center mb-6 bg-black/20 p-4 rounded-lg border border-white/5">
        <div>
          <h2 className="text-xl font-bold">Edit Album Texts</h2>
          <p className="text-sm text-muted">Customize the typography for the cover spine and title page.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        
        {/* Editing Form */}
        <div className="glass-card p-6 flex flex-col gap-6">
          <h3 className="uppercase tracking-widest text-[10px] text-muted font-bold border-b border-white/10 pb-2">Global Text Fields</h3>
          
          {DEFAULT_TEXT_TARGETS.map(field => {
            const currentObj = texts.find(t => t.target === field.id);
            const val = currentObj ? currentObj.content : '';
            return (
              <div key={field.id} className="input-group">
                <div className="flex justify-between">
                  <label className="label">{field.label}</label>
                  <span className="text-[10px] text-muted">{val.length} / {field.maxLength}</span>
                </div>
                <input 
                  type="text" 
                  className={`input ${val.length > field.maxLength ? 'border-red-500' : ''}`}
                  value={val}
                  onChange={e => handleTextChange(field.id, e.target.value)}
                  placeholder={`Enter ${field.label}...`}
                />
                {val.length > field.maxLength && (
                  <div className="text-red-400 text-xs mt-1">Warning: text may overflow or be truncated in print.</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Live Typography Preview (Approximation) */}
        <div className="bg-white rounded-lg p-8 relative shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col justify-center items-center h-[500px] border border-white/10">
          {/* A fake representation of Page 1 */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-black via-white to-black"></div>
          
          <div className="text-center z-10 w-full flex flex-col gap-12 text-black">
            <div>
              <div className="font-londrina text-5xl uppercase tracking-wider text-black opacity-90 mx-auto" style={{fontFamily: 'system-ui', fontWeight: 900}}>
                {texts.find(t => t.target === 'interior_dest')?.content || 'DESTINATION'}
              </div>
              <div className="font-londrina text-xl mt-3 text-black opacity-80" style={{fontFamily: 'system-ui', fontWeight: 700}}>
                {texts.find(t => t.target === 'interior_year')?.content || '[ 2026 ]'}
              </div>
            </div>

            <div className="mt-16">
              <div className="font-bold text-lg uppercase tracking-widest text-black/80">
                {texts.find(t => t.target === 'interior_name')?.content || 'CLIENT NAME'}
              </div>
              <div className="font-bold text-sm text-black/50 mt-2">
                {texts.find(t => t.target === 'interior_website')?.content || 'storiz.ma'}
              </div>
            </div>
          </div>
          
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] px-2 py-1 rounded">Title Page Preview</div>
        </div>

      </div>

      <div className="flex justify-between mt-4">
        {onBack && <button className="btn btn-secondary" onClick={onBack} disabled={saving}>Back</button>}
        <button className="btn btn-primary" onClick={saveTexts} disabled={saving}>
          {saving ? 'Saving Texts...' : 'Save Texts & Continue'}
        </button>
      </div>
    </div>
  );
}
