import React, { useRef, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';

const Page = React.forwardRef((props, ref) => {
  const isCover = props.isCover;
  return (
    <div 
      className={`demoPage overflow-hidden relative ${isCover ? '' : 'bg-white shadow-[0_0_15px_rgba(0,0,0,0.1)]'}`} 
      ref={ref} 
      data-density={props.density || 'soft'}
    >
      {props.children}
    </div>
  );
});

export default function PreviewModal({ isOpen, onClose, pages }) {
  if (!isOpen) return null;

  const flipBook = useRef(null);
  const [currentSpread, setCurrentSpread] = useState('');

  const handleFlip = (e) => {
    const leftIdx = e.data;
    const rightIdx = e.data + 1;
    const leftPage = pages[leftIdx];
    const rightPage = pages[rightIdx];

    const getLabel = (p) => {
      if (!p) return null;
      if (p.page_type === 'front_cover') return 'Front Cover';
      if (p.page_type === 'back_cover') return 'Back Cover';
      if (p.original_type === 'title') return 'Title';
      if (p.original_type === 'blank') return '';
      return `Page ${p.position}`; // Simple page index naming
    };

    const lLabel = getLabel(leftPage);
    const rLabel = getLabel(rightPage);

    if (lLabel && rLabel) setCurrentSpread(`${lLabel} faces ${rLabel}`);
    else if (lLabel) setCurrentSpread(lLabel);
    else setCurrentSpread('');
  };

  const renderPage = (p) => {
    if (p.page_type === 'front_cover' || p.page_type === 'back_cover') {
      return (
        <div 
          className="w-full h-full flex flex-col items-center justify-center relative"
          style={{ 
            backgroundColor: p.background?.color || '#000033',
            backgroundImage: p.background?.front ? `url(${p.background.front})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
           <div className="z-10 font-bold text-center flex flex-col items-center w-full relative pt-12">
             {p.text_elements.map(t => (
               <div key={t.id} style={{
                  color: t.color || '#fff',
                  fontSize: `${t.font_size}px`,
                  fontWeight: t.font === 'Londrina Solid' ? 900 : 700,
                  fontFamily: t.font,
                  lineHeight: 1.1,
                  textShadow: '0px 2px 10px rgba(0,0,0,0.3)',
                  textTransform: 'uppercase',
                  whiteSpace: 'pre-wrap'
               }}>
                 {t.content}
               </div>
             ))}
           </div>
        </div>
      );
    }
    
    if (p.original_type === 'title') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: p.background?.color || '#fff' }}>
          <div className="flex flex-col gap-6 w-full items-center text-black">
            {p.text_elements.map(t => (
               <div key={t.id} style={{
                  color: t.color || '#000',
                  fontSize: `${t.font_size}px`,
                  fontWeight: t.font === 'Londrina Solid' ? 900 : 700,
                  fontFamily: t.font,
                  lineHeight: 1.1,
                  textTransform: 'uppercase'
               }}>
                 {t.content}
               </div>
            ))}
          </div>
        </div>
      );
    }

    if (p.original_type === 'photo_grid') {
      let layoutClass = 'flex flex-col h-full';
      if (p.image_slots.length > 2) layoutClass = 'flex flex-wrap h-full content-start';
      
      return (
        <div className="w-full h-full p-3 box-border relative" style={{ backgroundColor: p.background?.color || '#fff' }}>
          {p.image_slots.length === 0 ? (
             <div className="w-full h-full" />
          ) : (
             <div className={`w-full gap-2 ${layoutClass}`}>
                {p.image_slots.map(s => (
                  <div key={s.slot_id} className="relative flex-grow basis-0 flex flex-col justify-center border-0" style={{ backgroundColor: '#f8f8f8', margin: '-1px' }}>
                    {s.image_url && <img src={s.image_url} className="w-full h-full object-cover pointer-events-none" alt="" />}
                  </div>
                ))}
             </div>
          )}
        </div>
      );
    }

    // fallback blanks
    return <div className="w-full h-full relative" style={{ backgroundColor: p.background?.color || '#fdfdfd' }}></div>;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-white/10 shrink-0">
        <h2 className="text-white text-lg font-bold tracking-wide">Interactive Preview</h2>
        <button 
          onClick={onClose}
          className="text-white/70 hover:text-white hover:bg-white/10 px-4 py-2 rounded-md transition-colors font-semibold"
        >
          ✕ Close Preview
        </button>
      </div>

      {/* Main Flipbook */}
      <div className="flex-1 flex justify-center items-center overflow-hidden py-10 relative">
        <div className="absolute left-10 top-1/2 -translate-y-1/2 z-20">
          <button 
            className="w-16 h-16 bg-white shadow-2xl text-gray-800 border-2 border-transparent hover:text-accent hover:border-accent hover:scale-105 rounded-full flex items-center justify-center text-4xl transition-all active:scale-95"
            onClick={() => flipBook.current?.pageFlip().flipPrev()}
          >
            ‹
          </button>
        </div>
        
        <div className="relative z-10 w-full h-full flex justify-center items-center">
          {pages.length > 0 ? (
            <HTMLFlipBook 
              width={480} 
              height={675} 
              size="fixed"
              minWidth={300} 
              maxWidth={600} 
              minHeight={422} 
              maxHeight={844} 
              maxShadowOpacity={0.4} 
              showCover={true} 
              mobileScrollSupport={true}
              className="shadow-2xl"
              ref={flipBook}
              useMouseEvents={true}
              onFlip={handleFlip}
            >
              {pages.map(p => (
                <Page 
                  key={p.id} 
                  density={p.page_type.includes('cover') ? 'hard' : 'soft'}
                  isCover={p.page_type === 'front_cover' || p.page_type === 'back_cover' || p.original_type === 'inner_cover'}
                >
                  {renderPage(p)}
                </Page>
              ))}
            </HTMLFlipBook>
          ) : (
            <div className="text-white">Loading...</div>
          )}
        </div>

        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-20">
           <button 
            className="w-16 h-16 bg-white shadow-2xl text-gray-800 border-2 border-transparent hover:text-accent hover:border-accent hover:scale-105 rounded-full flex items-center justify-center text-4xl transition-all active:scale-95"
            onClick={() => flipBook.current?.pageFlip().flipNext()}
          >
            ›
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 flex justify-center shrink-0">
         {currentSpread && (
           <div className="bg-white/10 px-6 py-2 rounded-full text-sm text-white/90 tracking-widest uppercase font-semibold">
             {currentSpread}
           </div>
         )}
      </div>
    </div>
  );
}
