import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import PageSpread from './PageSpread';

export default function PlacementEditor({ orderId, album, photos, onComplete, onBack }) {
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('auto'); // 'auto' | 'manual'

  useEffect(() => {
    fetchPlacements();
  }, [album.id]);

  const fetchPlacements = async () => {
    setLoading(true);
    try {
      const data = await api.placements.get(album.id);
      setPlacements(data || []);
    } catch (err) {
      console.error('Failed to fetch placements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoPlacement = async () => {
    setLoading(true);
    try {
      const formattedPhotos = photos.map(p => ({
        url: p.url,
        name: p.name,
        width: p.width,
        height: p.height
      }));
      const newPlacements = await api.placements.auto(album.id, {
        photos: formattedPhotos,
        pageCount: album.page_count,
        layoutType: album.layout
      });
      setPlacements(newPlacements);
      setMode('manual'); // switch to manual after auto
    } catch (err) {
      alert('Auto placement failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDropPhoto = (source, targetPageNumber) => {
    if (!source || source.pageNumber === targetPageNumber) return;

    let updated = [...placements];
    const sourceIndex = updated.findIndex(p => p.page_number === source.pageNumber && p.slot_index === source.slotIndex);
    
    if (sourceIndex === -1) return;

    // Swap with first photo in target page, or just append
    const targetPhotos = updated.filter(p => p.page_number === targetPageNumber);
    
    if (targetPhotos.length > 0) {
      // Swap source with target first photo
      const targetIndex = updated.findIndex(p => p.id === targetPhotos[0].id);
      const tempPage = updated[sourceIndex].page_number;
      const tempSlot = updated[sourceIndex].slot_index;
      
      updated[sourceIndex].page_number = updated[targetIndex].page_number;
      updated[sourceIndex].slot_index = updated[targetIndex].slot_index;
      
      updated[targetIndex].page_number = tempPage;
      updated[targetIndex].slot_index = tempSlot;
    } else {
      // Just move to empty page
      updated[sourceIndex].page_number = targetPageNumber;
      updated[sourceIndex].slot_index = 0;
    }

    setPlacements(updated);
  };

  const savePlacements = async () => {
    setSaving(true);
    try {
      await api.placements.update(album.id, placements);
      onComplete(placements);
    } catch (err) {
      alert('Failed to save placements: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Group placements by page (1 to page_count)
  const pages = Array.from({ length: album.page_count }, (_, i) => i + 1);

  if (loading) return <div className="p-8 text-center"><div className="spinner mb-4"></div><p>Loading placements...</p></div>;

  return (
    <div className="placement-editor animate-fade-in">
      <div className="flex justify-between items-center mb-6 bg-black/20 p-4 rounded-lg border border-white/5">
        <div>
          <h2 className="text-xl font-bold">Photo Placements</h2>
          <p className="text-sm text-muted">Arrange {photos.length} photos across {album.page_count} pages.</p>
        </div>
        <div className="flex gap-2">
          {mode === 'auto' ? (
             <button className="btn btn-secondary flex items-center gap-2 text-accent border-accent" onClick={handleAutoPlacement}>
               ✨ Auto Fill
             </button>
          ) : (
            <button className="btn btn-secondary border-accent text-accent" onClick={() => handleAutoPlacement()}>
               🔄 Rerun Auto
            </button>
          )}
        </div>
      </div>

      {placements.length === 0 ? (
        <div className="empty-state glass-card text-center py-12 mb-8">
          <div className="text-4xl mb-4">🧩</div>
          <h3 className="text-lg font-bold mb-2">No Placements Yet</h3>
          <p className="text-muted mb-6 text-sm">Use auto-fill to automatically distribute your uploaded photos across the book.</p>
          <button className="btn btn-primary" onClick={handleAutoPlacement}>✨ Auto Fill Book</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-white/5 rounded-lg border border-white/10 mb-8 max-h-[60vh] overflow-y-auto">
          {pages.map(pageNum => {
            const pagePlacements = placements.filter(p => p.page_number === pageNum).sort((a,b) => a.slot_index - b.slot_index);
            return (
              <PageSpread 
                key={pageNum} 
                pageNumber={pageNum} 
                placements={pagePlacements}
                onDropPhoto={handleDropPhoto} 
              />
            );
          })}
        </div>
      )}

      <div className="flex justify-between mt-4">
        {onBack && <button className="btn btn-secondary" onClick={onBack} disabled={saving}>Back</button>}
        <button className="btn btn-primary" onClick={savePlacements} disabled={saving || placements.length === 0}>
          {saving ? 'Saving...' : 'Save Placements & Continue'}
        </button>
      </div>
    </div>
  );
}
