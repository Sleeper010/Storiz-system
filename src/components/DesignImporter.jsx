import { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { api } from '../utils/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Renders a single-page PDF URL to a canvas thumbnail + extracts bg color.
 */
async function renderPageToThumbnail(pageUrl, canvas) {
  const loadingTask = pdfjsLib.getDocument(pageUrl);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 0.35 });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width  = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const px = ctx.getImageData(10, 10, 1, 1).data;
  const bgColor  = `#${[px[0], px[1], px[2]].map(x => x.toString(16).padStart(2, '0')).join('')}`;
  const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
  return { bgColor, thumbnail };
}

export default function DesignImporter({ onComplete, initialFile }) {
  const [file,          setFile]          = useState(initialFile || null);
  const [step,          setStep]          = useState('upload');  // 'upload' | 'processing' | 'naming' | 'saving' | 'done'
  const [rawPages,      setRawPages]      = useState([]);        // from server: { pageIndex, url, fileName }[]
  const [designs,       setDesigns]       = useState([]);        // { url, thumbnail, bgColor, name, isFront }[]
  const [saving,        setSaving]        = useState(false);
  const [saveErrors,    setSaveErrors]    = useState([]);
  const [processingMsg, setProcessingMsg] = useState('');
  const canvasRef = useRef(null);

  // Auto-start import if provided via drag-and-drop
  useEffect(() => {
    if (initialFile) {
      handleStartImport(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 1: Upload PDF to server ────────────────────────────────────────────
  const handleStartImport = async (fileToUpload) => {
    const targetFile = (fileToUpload instanceof File ? fileToUpload : null) || file;
    if (!targetFile) return;
    setStep('processing');
    setProcessingMsg('Uploading and splitting PDF…');

    const formData = new FormData();
    formData.append('pdf', targetFile);

    try {
      const response = await api.destinations.import(formData);
      const pages = response.pages || [];
      setRawPages(pages);
      setStep('processing');
      await renderAllPages(pages);
    } catch (err) {
      alert('Upload failed: ' + err.message);
      setStep('upload');
    }
  };

  // ── Step 2: Render each page to thumbnail ───────────────────────────────────
  const renderAllPages = async (pages) => {
    const canvas = canvasRef.current;
    const rendered = [];

    for (let i = 0; i < pages.length; i++) {
      setProcessingMsg(`Rendering preview ${i + 1} / ${pages.length}…`);
      try {
        const { bgColor, thumbnail } = await renderPageToThumbnail(pages[i].url, canvas);
        rendered.push({ url: pages[i].url, thumbnail, bgColor, name: '', pageIndex: pages[i].pageIndex });
      } catch (err) {
        console.error('Render error page', i, err);
        rendered.push({ url: pages[i].url, thumbnail: null, bgColor: '#000000', name: '', pageIndex: pages[i].pageIndex });
      }
    }

    // For Canva exports: LAST page = front cover, FIRST page = back cover
    // Pair them: destinations = every pair [back, front], or single page if only 1
    const destinations = [];
    if (rendered.length === 1) {
      // Single page — treat as front cover
      destinations.push({ front: rendered[0], back: null, name: '', bgColor: rendered[0].bgColor });
    } else {
      // Canva export order: page 1 = BACK cover, page 2 = FRONT cover
      for (let i = 0; i < rendered.length; i += 2) {
        const back  = rendered[i];
        const front = rendered[i + 1] || null;
        destinations.push({
          front,
          back,
          name:    '',
          bgColor: (front || back)?.bgColor || '#000000',
        });
      }
    }

    setDesigns(destinations);
    setStep('naming');
  };

  // ── Step 3: Save named designs ──────────────────────────────────────────────
  const handleSave = async () => {
    const toSave = designs.filter(d => d.name.trim().length > 0);
    if (toSave.length === 0) {
      alert('Please enter a name for at least one destination before saving.');
      return;
    }

    setSaving(true);
    setSaveErrors([]);
    const errors = [];

    for (const d of toSave) {
      try {
        await api.destinations.create({
          name:             d.name.trim(),
          cover_url:        d.front?.url || d.back?.url || null,
          back_cover_url:   d.back?.url  || null,
          background_color: d.bgColor,
        });
      } catch (err) {
        console.error('Save error for', d.name, err);
        errors.push(d.name);
      }
    }

    setSaving(false);

    if (errors.length > 0) {
      setSaveErrors(errors);
      alert(`Failed to save: ${errors.join(', ')}. Others were saved successfully.`);
    } else {
      setStep('done');
      setTimeout(onComplete, 800);
    }
  };

  const updateDesign = (i, updates) =>
    setDesigns(prev => prev.map((d, idx) => idx === i ? { ...d, ...updates } : d));

  // ── Renders ─────────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="design-importer glass-card p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📄</div>
          <h3 className="text-xl font-bold mb-2">Import Cover Design</h3>
          <p className="text-sm text-muted max-w-md mx-auto">
            Upload your cover PDF from Canva. Works for single designs or bulk imports with multiple pages.
            <br/>
            <span className="text-accent font-medium">Each 2-page pair = 1 destination (back + front)</span>, or a single page on its own.
          </p>
        </div>

        <div className="glass-card p-6 border-dashed border-2 border-white/20 text-center mb-6">
          <label className="cursor-pointer block">
            <input type="file" accept=".pdf" className="hidden" onChange={e => setFile(e.target.files[0])} />
            {file ? (
              <div>
                <div className="text-2xl mb-2">📎</div>
                <div className="font-bold text-accent">{file.name}</div>
                <div className="text-xs text-muted mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB — click to change</div>
              </div>
            ) : (
              <div>
                <div className="text-3xl mb-3">+</div>
                <div className="font-semibold">Click to choose PDF file</div>
                <div className="text-xs text-muted mt-1">or drag and drop</div>
              </div>
            )}
          </label>
        </div>

        <div className="flex gap-3 justify-end">
          <button className="btn btn-secondary" onClick={onComplete}>Cancel</button>
          <button className="btn btn-primary px-8" onClick={handleStartImport} disabled={!file}>
            Start Import
          </button>
        </div>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="design-importer glass-card p-12 text-center animate-fade-in">
        <div className="spinner spinner-lg mx-auto mb-6" />
        <h3 className="text-lg font-bold mb-2">Processing PDF</h3>
        <p className="text-sm text-muted">{processingMsg}</p>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="design-importer glass-card p-12 text-center animate-fade-in">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-xl font-bold mb-2">Designs Saved!</h3>
        <p className="text-sm text-muted">Returning to destination library…</p>
      </div>
    );
  }

  // ── Naming step ─────────────────────────────────────────────────────────────
  return (
    <div className="design-importer glass-card p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold">Name Your Designs</h3>
          <p className="text-sm text-muted mt-1">
            {designs.length} design{designs.length !== 1 ? 's' : ''} detected — enter a name for each you want to save.
            Leave blank to skip.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { setStep('upload'); setFile(null); setDesigns([]); }}>
          ← Start Over
        </button>
      </div>

      <div className="flex flex-col gap-4 mb-6" style={{ maxHeight: '55vh', overflowY: 'auto', paddingRight: '8px' }}>
        {designs.map((d, i) => (
          <div key={i} className="glass-card p-4 flex gap-5 items-center">
            {/* Thumbnails */}
            <div className="flex gap-2 flex-shrink-0">
              <div className="text-center">
                <div className="text-[9px] text-muted uppercase tracking-widest mb-1">Front</div>
                <div style={{ width: 64, height: 90, background: '#1a1a2e', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {d.front?.thumbnail
                    ? <img src={d.front.thumbnail} alt="front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#666' }}>—</div>
                  }
                </div>
              </div>
              <div className="text-center">
                <div className="text-[9px] text-muted uppercase tracking-widest mb-1">Back</div>
                <div style={{ width: 64, height: 90, background: '#1a1a2e', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {d.back?.thumbnail
                    ? <img src={d.back.thumbnail} alt="back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#666' }}>—</div>
                  }
                </div>
              </div>
            </div>

            {/* Name + color */}
            <div className="flex-1 flex flex-col gap-3">
              <input
                type="text"
                className="input"
                placeholder={`Destination name (e.g. "Memories", "Morocco")`}
                value={d.name}
                onChange={e => updateDesign(i, { name: e.target.value })}
                autoFocus={i === 0}
              />
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted">Spine colour:</label>
                <input
                  type="color"
                  value={d.bgColor}
                  onChange={e => updateDesign(i, { bgColor: e.target.value })}
                  style={{ width: 32, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 0, background: 'none' }}
                />
                <div className="w-6 h-6 rounded border border-white/20" style={{ background: d.bgColor }} />
                <span className="text-xs text-muted font-mono">{d.bgColor}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-white/10">
        <span className="text-sm text-muted">
          {designs.filter(d => d.name.trim()).length} of {designs.length} named
        </span>
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={onComplete}>Cancel</button>
          <button
            className="btn btn-primary px-8"
            onClick={handleSave}
            disabled={saving || designs.every(d => !d.name.trim())}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="spinner spinner-sm" /> Saving…
              </span>
            ) : `Save ${designs.filter(d => d.name.trim()).length || ''} Design${designs.filter(d => d.name.trim()).length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
