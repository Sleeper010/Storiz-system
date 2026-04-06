import { useState } from 'react';

export default function PageSpread({ pageNumber, placements, onDropPhoto, onDragStart }) {
  // Determine layout class primarily based on number of photos on this page
  let layoutClass = 'layout-single';
  if (placements.length === 2) layoutClass = 'layout-split-h';
  if (placements.length === 3) layoutClass = 'layout-grid-3';
  if (placements.length === 4) layoutClass = 'layout-grid-4';

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-accent');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-accent');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-accent');
    const dragData = e.dataTransfer.getData('application/json');
    if (dragData) {
      const source = JSON.parse(dragData);
      onDropPhoto(source, pageNumber);
    }
  };

  return (
    <div 
      className="bg-white text-black w-full aspect-[1/1.414] relative rounded-sm shadow-sm overflow-hidden box-border border-2 border-transparent transition-colors"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="absolute top-2 left-2 z-10 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded backdrop-blur-sm pointer-events-none">
        Page {pageNumber}
      </div>
      
      {placements.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-300 m-2 rounded bg-gray-50 text-gray-400 text-xs">
          Drop photo here
        </div>
      ) : (
        <div className={`w-full h-full p-2 flex flex-wrap content-start gap-2 ${layoutClass}`}>
          {placements.map((p, i) => (
            <div 
              key={p.id || i}
              draggable
              onDragStart={(e) => {
                const data = JSON.stringify({ placementId: p.id, pageNumber, slotIndex: p.slot_index });
                e.dataTransfer.setData('application/json', data);
                if (onDragStart) onDragStart(p);
              }}
              className="relative bg-gray-200 overflow-hidden group cursor-move shadow flex-grow basis-0"
              style={{ flexBasis: placements.length > 2 ? '45%' : '100%', minHeight: placements.length > 1 ? '45%' : '100%' }}
            >
              <img 
                src={p.photo_url} 
                alt="Page slot" 
                className="w-full h-full object-cover drag-none pointer-events-none"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 flex rounded backdrop-blur-sm">Drag to move</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
