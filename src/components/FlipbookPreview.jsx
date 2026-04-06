import React, { useState, useEffect, useRef } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { api } from '../utils/api';

const Page = React.forwardRef((props, ref) => {
  return (
    <div className="demoPage bg-white shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-gray-200 overflow-hidden relative" ref={ref} data-density="hard">
      {props.children}
    </div>
  );
});

export default function FlipbookPreview({ album, onComplete, onBack }) {
  const [placements, setPlacements] = useState([]);
  const [texts, setTexts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [pData, tData] = await Promise.all([
          api.placements.get(album.id),
          api.texts.get(album.id)
        ]);
        setPlacements(pData || []);
        setTexts(tData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [album.id]);

  const getText = (target) => texts.find(t => t.target === target)?.content || '';

  if (loading) return <div className="p-12 text-center"><div className="spinner mb-4"></div><p>Loading flipbook...</p></div>;

  // We have album.page_count pages (e.g. 60).
  // Pages 1-2 are the branding/title pages technically.
  // The placements starts at page_number 1 (which refers to photo page 1).
  // A real book layout: Cover -> Inner cover -> Title page -> Photos.
  // For the preview, we'll show:
  // Page 1: Destination Title
  // Pages 2 to N+1: The photos
  
  const totalPhotoPages = album.page_count;
  const pagesArray = Array.from({ length: totalPhotoPages }, (_, i) => i + 1);

  return (
    <div className="flipbook-preview animate-fade-in relative">
      <div className="flex justify-between items-center mb-6 bg-black/20 p-4 rounded-lg border border-white/5">
        <div>
          <h2 className="text-xl font-bold">Interactive Preview</h2>
          <p className="text-sm text-muted">A fast 2D preview of your placements to check layout flows.</p>
        </div>
      </div>

      <div className="flex justify-center items-center py-8 bg-gray-100 dark:bg-[#1a1a1a] rounded-xl overflow-hidden shadow-inner mb-8">
        {/* HTMLFlipBook requires fixed dimensions. For responsive logic you typically calculate it or use CSS. */}
        <HTMLFlipBook 
          width={400} 
          height={565} 
          size="fixed"
          minWidth={300} 
          maxWidth={600} 
          minHeight={424} 
          maxHeight={848} 
          maxShadowOpacity={0.5} 
          showCover={true} 
          mobileScrollSupport={true}
          className="flipbook shadow-2xl"
        >
          {/* Cover Page */}
          <Page>
            <div className="w-full h-full flex flex-col items-center justify-center relative bg-[url('https://i.imgur.com/3YxHxq2.jpg')] bg-cover">
               <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
               <div className="z-10 text-white font-bold text-center">
                 <div className="text-4xl uppercase tracking-widest font-londrina">{getText('cover_spine_title')}</div>
                 <div className="text-lg mt-2">{getText('cover_spine_year')}</div>
               </div>
            </div>
          </Page>

          {/* Inner blank cover */}
          <Page>
            <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300">
               <span className="text-xs">Inner Cover</span>
            </div>
          </Page>

          {/* Title Page (Right side) */}
          <Page>
            <div className="w-full h-full bg-white flex flex-col items-center justify-center text-black">
              <div className="font-londrina text-4xl uppercase tracking-wider text-black opacity-90 mx-auto" style={{fontFamily: 'system-ui', fontWeight: 900}}>
                {getText('interior_dest')}
              </div>
              <div className="font-londrina text-lg mt-2 text-black opacity-80" style={{fontFamily: 'system-ui', fontWeight: 700}}>
                {getText('interior_year')}
              </div>
              <div className="mt-12 text-center">
                <div className="font-bold text-base uppercase tracking-widest text-black/80">
                  {getText('interior_name')}
                </div>
                <div className="font-bold text-xs text-black/50 mt-1">
                  {getText('interior_website')}
                </div>
              </div>
            </div>
          </Page>

          {/* Blank Left Page */}
          <Page><div className="w-full h-full bg-white border-l border-gray-100"></div></Page>

          {/* Photo Pages */}
          {pagesArray.map(pageNum => {
            const photos = placements.filter(p => p.page_number === pageNum).sort((a,b) => a.slot_index - b.slot_index);
            let layoutClass = 'flex flex-col h-full';
            if (photos.length === 2) layoutClass = 'flex flex-col h-full';
            if (photos.length > 2) layoutClass = 'flex flex-wrap h-full content-start';

            return (
              <Page key={pageNum}>
                <div className="w-full h-full bg-white border-x border-gray-100 flex p-4 box-border">
                  {photos.length === 0 ? (
                     <div className="flex-1 border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs">No Photos</div>
                  ) : (
                     <div className={`w-full gap-2 ${layoutClass}`}>
                        {photos.map(p => (
                           <div key={p.id} className="bg-gray-100 flex-grow basis-0" style={{flexBasis: photos.length > 2 ? '45%' : '100%', minHeight: photos.length > 1 ? '45%' : '100%'}}>
                             <img src={p.photo_url} className="w-full h-full object-cover" alt="" />
                           </div>
                        ))}
                     </div>
                  )}
                </div>
              </Page>
            );
          })}

          {/* End Blank pages */}
          <Page><div className="w-full h-full bg-white border-r border-gray-100"></div></Page>
          <Page><div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300"><span className="text-xs">End Cover</span></div></Page>

        </HTMLFlipBook>
      </div>

      <div className="flex justify-between mt-4">
        {onBack && <button className="btn btn-secondary" onClick={onBack}>Back to Texts</button>}
        <button className="btn btn-primary" onClick={() => onComplete()}>
          Looks Good, Next Album →
        </button>
      </div>
    </div>
  );
}
