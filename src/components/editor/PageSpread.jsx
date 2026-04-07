import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';

// Helper for the text inputs
const TextElementEditor = ({ textObj, background, onSaveText }) => {
  const [val, setVal] = React.useState(textObj.content || '');

  const style = {
    color: textObj.color || '#000',
    fontSize: `${textObj.font_size}px`,
    fontWeight: textObj.font === 'Londrina Solid' ? 900 : 700,
    fontFamily: textObj.font,
    textAlign: textObj.alignment || 'center',
    textShadow: background?.front ? '0px 2px 10px rgba(0,0,0,0.3)' : 'none',
    lineHeight: 1.1,
    textTransform: 'uppercase',
  };

  return (
    <textarea
      className="bg-transparent w-[90%] resize-none overflow-hidden outline-none transition-colors rounded hover:bg-black/10 focus:bg-white/90 focus:text-black focus:shadow-lg border-2 border-transparent hover:border-blue-400/50 focus:border-blue-500 p-2 text-center"
      style={style}
      value={val}
      placeholder="CLICK TO TYPE"
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSaveText(textObj.id, textObj.field_name, val)}
    />
  );
};

// Helper for draggable image inside a slot
const DraggableSlotImage = ({ slot }) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: slot.slot_id,
    data: { type: 'PLACED_PHOTO', slot },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-full h-full cursor-grab active:cursor-grabbing relative group z-10"
      {...attributes}
      {...listeners}
    >
      <img src={slot.image_url} alt="" className="w-full h-full object-cover rounded-sm shadow-sm" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-blue-500/20 transition-colors rounded-sm pointer-events-none" />
    </div>
  );
};

// The slot dropping area
const DroppableSlot = ({ slot }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: slot.slot_id,
    data: { type: 'SLOT', slot },
  });

  return (
    <div 
      ref={setNodeRef}
      className={`relative flex-grow basis-0 flex flex-col justify-center border-2 transition-all rounded-sm ${isOver ? 'border-accent bg-accent/10 scale-105 z-20 shadow-xl' : 'border-dashed border-gray-300 bg-gray-50 hover:border-blue-300'}`}
      style={{ margin: '2px' }}
    >
      {slot.image_url ? (
        <DraggableSlotImage slot={slot} />
      ) : (
        <div className="text-center text-gray-400 text-[10px] uppercase font-bold tracking-widest p-4">
          Empty Slot
        </div>
      )}
    </div>
  );
};

const PageCanvas = ({ page, side, onSaveText }) => {
  if (!page) return <div className="w-1/2 h-full" />; // Empty placeholder for lonely spreads

  // Physical rendering logic matching PDF
  const isFrontCover = page.page_type === 'front_cover';
  const isBackCover = page.page_type === 'back_cover';
  const isCover = isFrontCover || isBackCover;

  const bgStyle = {
    backgroundColor: page.background?.color || '#ffffff',
    backgroundImage: page.background?.front && isFrontCover ? `url(${page.background.front})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div 
      className={`w-1/2 h-full flex flex-col relative transition-transform ${side === 'left' ? 'border-r border-black/10' : ''}`}
      style={bgStyle}
    >
      {/* Cover Titles */}
      {isCover && page.text_elements.length > 0 && (
         <div className="absolute inset-0 z-20 flex flex-col items-center pt-12">
           {page.text_elements.map(t => (
             <TextElementEditor key={t.id} textObj={t} background={page.background} onSaveText={(id, field, val) => onSaveText(page.id, field, val)} />
           ))}
         </div>
      )}

      {/* Title Page */}
      {page.original_type === 'title' && (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-black">
          <div className="flex flex-col gap-6 w-full items-center">
            {page.text_elements.map(t => (
              <TextElementEditor key={t.id} textObj={t} background={page.background} onSaveText={(id, field, val) => onSaveText(page.id, field, val)} />
            ))}
          </div>
        </div>
      )}

      {/* Photo Grid */}
      {page.image_slots.length > 0 && (
        <div className="w-full h-full p-4 box-border relative z-10 flex flex-col">
          {page.image_slots.map(s => <DroppableSlot key={s.slot_id} slot={s} />)}
        </div>
      )}

      {/* Empty Generic Grid */}
      {page.original_type === 'photo_grid' && page.image_slots.length === 0 && (
        <div className="w-full h-full p-4 box-border relative z-10 flex flex-col">
          <DroppableSlot slot={{ slot_id: `empty_main_${page.id}`, image_url: null }} />
        </div>
      )}

      {/* Print Page Numbers for grid pages */}
      {page.page_type === 'interior' && page.original_type !== 'blank' && page.original_type !== 'inner_cover' && (
         <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none opacity-50">
           <span className="text-[9px] text-gray-800 font-bold tracking-widest">{page.position}</span>
         </div>
      )}
    </div>
  );
};

export default function PageSpread({ spreadObj, onSaveText }) {
  if (!spreadObj) return null;

  return (
    <div className="flex flex-col items-center mb-16 px-4">
       <div className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-4 opacity-70">
         Spread {spreadObj.index}
       </div>
       
       <div className="flex w-full max-w-[800px] aspect-[1.414/1] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)] rounded-sm overflow-hidden">
         <PageCanvas page={spreadObj.left} side="left" onSaveText={onSaveText} />
         <PageCanvas page={spreadObj.right} side="right" onSaveText={onSaveText} />
       </div>
    </div>
  );
}
