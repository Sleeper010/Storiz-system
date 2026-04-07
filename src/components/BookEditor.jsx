import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import GridEditor from './editor/GridEditor';
import PreviewModal from './editor/PreviewModal';

export default function BookEditor({ order, album, photos, onComplete, onBack }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    fetchPages();
  }, [album.id]);

  const fetchPages = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/editor/${album.id}/pages`);
      setPages(data || []);
    } catch (err) {
      console.error('Failed to load pages:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveTextChanges = async (pageId, field_name, newContent) => {
    // Optimistic local update
    setPages(prev => prev.map(p => {
      if (p.id === pageId) {
        return {
          ...p,
          text_elements: p.text_elements.map(t => 
            t.field_name === field_name ? { ...t, content: newContent } : t
          )
        };
      }
      return p;
    }));

    try {
      await apiRequest(`/api/editor/${album.id}/pages`, {
        method: 'PUT',
        body: JSON.stringify({ texts: [{ target: field_name, content: newContent }] })
      });
    } catch (err) {
      console.error('Failed to save text', err);
    }
  };

  const swapPhotos = async (sourceId, targetSlotId, targetPageId, sourceType) => {
    if (sourceId === targetSlotId) return;

    // We will do a full optimistic update to be responsive
    let newPages = JSON.parse(JSON.stringify(pages));
    
    // Find Source Page/Slot
    let sourcePage = null;
    let sourceSlot = null;
    
    if (sourceType === 'PLACED_PHOTO') {
      newPages.forEach(p => {
        const s = p.image_slots.find(slot => slot.slot_id === sourceId);
        if (s) { sourceSlot = s; sourcePage = p; }
      });
    } else {
      // UNPLACED_PHOTO
      const raw = photos.find(p => p.id === sourceId);
      if (raw) {
        sourceSlot = { 
          slot_id: raw.id, 
          assigned_image_id: raw.id, 
          image_url: raw.url || raw.photo_url || raw.preview 
        };
      }
    }

    if (!sourceSlot) return;

    let targetPage = newPages.find(p => p.id === targetPageId);
    if (!targetPage) return;

    if (targetSlotId.startsWith('empty_main_')) {
      // Dropping into an entirely empty page (no slots yet)
      targetPage.image_slots.push({
        slot_id: sourceSlot.slot_id + '_new',
        position: 0,
        assigned_image_id: sourceSlot.assigned_image_id,
        image_url: sourceSlot.image_url
      });
      // Remove from source page if it came from one
      if (sourcePage) {
        sourcePage.image_slots = sourcePage.image_slots.filter(s => s.slot_id !== sourceSlot.slot_id);
      }
    } else {
      // Swapping slots
      const tSlot = targetPage.image_slots.find(s => s.slot_id === targetSlotId);
      if (!tSlot) return;
      
      const sourceCopy = { ...sourceSlot };
      
      tSlot.assigned_image_id = sourceCopy.assigned_image_id;
      tSlot.image_url = sourceCopy.image_url;
      
      if (sourcePage) {
        const orgTarget = pages.find(p => p.id === targetPageId).image_slots.find(s => s.slot_id === targetSlotId);
        const sSlot = sourcePage.image_slots.find(s => s.slot_id === sourceSlot.slot_id);
        
        sSlot.assigned_image_id = orgTarget.assigned_image_id;
        sSlot.image_url = orgTarget.image_url;
      }
    }

    setPages(newPages);

    // Sync placements to DB
    const updatedPlacements = [];
    newPages.forEach(p => {
      if (p.original_type === 'photo_grid') {
        p.image_slots.forEach((s, idx) => {
           if (s.assigned_image_id) {
             updatedPlacements.push({
               id: s.assigned_image_id,
               page_number: p.position, // The backend expects the logical page number matching original sorting
               slot_index: idx
             });
           }
        });
      }
    });

    try {
      await apiRequest(`/api/editor/${album.id}/pages`, {
        method: 'PUT',
        body: JSON.stringify({ placements: updatedPlacements })
      });
    } catch (err) {
      console.error('Failed to swap photos', err);
    }
  };

  const handleAutoFill = async () => {
    setLoading(true);
    try {
      const formattedPhotos = photos.map(p => ({
        url: p.url || p.photo_url || p.preview,
        name: p.name || p.photo_name,
        width: p.width,
        height: p.height
      }));
      const res = await apiRequest(`/api/editor/${album.id}/auto`, {
        method: 'POST',
        body: JSON.stringify({ photos: formattedPhotos, pageCount: album.page_count, layoutType: album.layout })
      });
      if (res.pages) setPages(res.pages);
    } catch (err) {
      alert('Auto fill failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center"><div className="spinner mb-4"></div><p className="text-gray-500 font-bold tracking-widest uppercase">Initializing Designer...</p></div>;
  }

  // Calculate unplaced photos safely
  const placedPhotoIds = new Set();
  pages.forEach(p => {
    (p.image_slots || []).forEach(s => { 
      if (s.assigned_image_id) placedPhotoIds.add(s.assigned_image_id); 
    });
  });
  const unplacedPhotos = photos.filter(p => !placedPhotoIds.has(p.id));

  const contentPages = pages.filter(p => p.page_type === 'interior' || p.type === 'interior');
  const filledPages = contentPages.filter(p => (p.image_slots || []).length > 0);

  return (
    <div className="flex flex-col h-screen max-h-[100vh]">
      
      {/* Top Toolbar */}
      <div className="flex justify-between items-center bg-white border-b border-gray-200 px-6 py-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-400 hover:text-black transition-colors mr-2">← Back</button>
          <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold">
            {album.album_index !== undefined ? album.album_index + 1 : 1}
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-gray-900 uppercase">
               {(album.destination?.name || 'Mosaïq Album').replace(/\s+\d+$/, '')}
            </div>
            <div className="text-[11px] text-gray-500 font-semibold tracking-wider uppercase">
               {filledPages.length} of {contentPages.length} Pages Filled
            </div>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <button 
            className="flex items-center gap-2 px-6 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs uppercase tracking-wider rounded-md transition-all shadow-sm border border-blue-200"
            onClick={() => setIsPreviewOpen(true)}
          >
            📖 Preview Book
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          
          <button 
            className="px-8 py-2 bg-[#18181A] hover:bg-black text-white font-bold text-xs uppercase tracking-wider rounded-md transition-all shadow-md active:scale-95" 
            onClick={() => onComplete(pages)} 
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Review & Finalize →'}
          </button>
        </div>
      </div>

      {/* Grid Editor (Main Drag/Drop Logic here) */}
      <GridEditor 
        pages={pages} 
        unplacedPhotos={unplacedPhotos}
        onDropPhoto={swapPhotos}
        onSaveText={saveTextChanges}
        onAutoFill={handleAutoFill}
      />

      {/* Full Screen Isolated Preview Modal */}
      <PreviewModal 
        isOpen={isPreviewOpen} 
        pages={pages} 
        onClose={() => setIsPreviewOpen(false)} 
      />

    </div>
  );
}
