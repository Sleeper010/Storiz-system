import React, { useMemo, useState } from 'react';
import { 
  DndContext, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  closestCenter, 
  DragOverlay,
  useDraggable
} from '@dnd-kit/core';
import PageSpread from './PageSpread';

const DraggableSidebarPhoto = ({ photo }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: photo.id,
    data: { type: 'UNPLACED_PHOTO', photo },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`relative bg-black/20 border-2 rounded-md hover:border-accent cursor-move transition-all aspect-[3/2] ${isDragging ? 'opacity-50 border-dashed border-gray-400' : 'border-transparent shadow-md'}`}
    >
      <img src={photo.url || photo.preview} className="w-full h-full object-cover rounded-md pointer-events-none" alt="" />
      {/* Index indicator */}
      <div className="absolute top-1 left-1 bg-black/60 px-1.5 py-0.5 rounded text-[9px] font-bold text-white tracking-wider">
        #{photo.position || photo.sort_order || '?'}
      </div>
    </div>
  );
};

export default function GridEditor({ pages, unplacedPhotos, onDropPhoto, onSaveText, onAutoFill }) {
  const [activeDragId, setActiveDragId] = useState(null);
  const [activeDragData, setActiveDragData] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Group pages into spreads
  const spreads = useMemo(() => {
    const map = new Map();
    pages.forEach(p => {
      const idx = p.spread_index;
      if (!map.has(idx)) map.set(idx, { index: idx, left: null, right: null });
      if (p.page_side === 'left') map.get(idx).left = p;
      if (p.page_side === 'right') map.get(idx).right = p;
    });
    return Array.from(map.values()).sort((a, b) => a.index - b.index);
  }, [pages]);

  const handleDragStart = (e) => {
    setActiveDragId(e.active.id);
    setActiveDragData(e.active.data.current);
  };

  const handleDragEnd = (e) => {
    setActiveDragId(null);
    setActiveDragData(null);
    const { active, over } = e;
    
    if (!over) return;
    
    if (over.data.current?.type === 'SLOT') {
      const sourceId = active.id;
      const targetSlotId = over.id; // `empty_main_pageID` or actual slot id if replacing
      
      const targetPageId = over.id.startsWith('empty_main_') 
        ? over.id.replace('empty_main_', '') 
        : pages.find(p => p.image_slots.some(s => s.slot_id === over.id))?.id;
        
      if (targetPageId) {
        onDropPhoto(sourceId, targetSlotId, targetPageId, active.data.current?.type);
      }
    }
  };

  // Render Drag overlay for smooth feeling
  const renderDragOverlay = () => {
    if (!activeDragId || !activeDragData) return null;
    
    let url = null;
    if (activeDragData.type === 'UNPLACED_PHOTO') url = activeDragData.photo.url;
    if (activeDragData.type === 'PLACED_PHOTO') url = activeDragData.slot.image_url;

    if (!url) return null;

    return (
      <div className="w-48 h-32 scale-105 shadow-2xl rounded opacity-90 border-2 border-accent">
        <img src={url} className="w-full h-full object-cover rounded pointer-events-none" alt="" />
      </div>
    );
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-1 items-stretch overflow-hidden bg-[#e8e9ea]">
        
        {/* LEFT SIDEBAR: PHOTO PANEL */}
        <div className="w-72 flex flex-col shrink-0 border-r border-gray-300 bg-[#1e1e1e] shadow-lg z-10">
          <div className="p-4 bg-[#141414] border-b border-gray-800 flex justify-between items-center z-10 shrink-0 shadow-md">
            <span className="text-[#A1A1AA] text-xs font-bold tracking-widest uppercase">
              Pool ({unplacedPhotos.length})
            </span>
            {unplacedPhotos.length > 0 && (
              <button 
                className="text-accent hover:text-white px-3 py-1 bg-accent/10 hover:bg-accent/30 font-semibold rounded text-xs border border-accent/20 transition-colors shadow-sm"
                onClick={onAutoFill}
              >
                ✨ Auto Fill
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
             {unplacedPhotos.map(photo => (
                <DraggableSidebarPhoto key={photo.id} photo={photo} />
             ))}
             {unplacedPhotos.length === 0 && (
                <div className="text-center text-xs text-gray-500 mt-10 p-4 bg-white/5 rounded border border-white/5">
                  <div className="text-3xl mb-3 opacity-30">🎉</div>
                  <strong className="block text-white/70 mb-1">All photos placed!</strong>
                  Review your spreads to the right before finalizing.
                </div>
             )}
          </div>
        </div>

        {/* MAIN CANVAS: SPREADS GRID */}
        <div className="flex-1 overflow-y-auto px-4 py-12 flex flex-col items-center">
            {spreads.map(spread => (
              <PageSpread 
                key={spread.index} 
                spreadObj={spread} 
                onSaveText={onSaveText}
              />
            ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {renderDragOverlay()}
      </DragOverlay>
    </DndContext>
  );
}
