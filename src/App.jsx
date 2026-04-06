import { useState, useEffect } from 'react';
import LoginGate from './components/LoginGate';
import OrderPanel from './components/OrderPanel';
import AlbumConfig from './components/AlbumConfig';
import PhotoUploader from './components/PhotoUploader';
import BrandingSettings from './components/BrandingSettings';
import ArchivePanel from './components/ArchivePanel';
import PlacementEditor from './components/PlacementEditor';
import TextEditor from './components/TextEditor';
import FlipbookPreview from './components/FlipbookPreview';
import { api } from './utils/api';
import './styles/index.css';

const NAV_ITEMS = [
  { id: 'home',    label: 'Dashboard', icon: '🏠' },
  { id: 'orders',  label: 'New Order',  icon: '🛒' },
  { id: 'archive', label: 'PDF Archive', icon: '🗄️' },
  { id: 'settings',label: 'Settings',   icon: '⚙️' },
];

const WORKFLOW_STEPS = [
  { id: 1, label: 'Configure', icon: '⚙️' },
  { id: 2, label: 'Photos',    icon: '📸' },
  { id: 3, label: 'Placements',icon: '🧩' },
  { id: 4, label: 'Texts',     icon: '📝' },
  { id: 5, label: 'Preview',   icon: '👀' },
  { id: 6, label: 'Generate',  icon: '🏗️' },
  { id: 7, label: 'Export',    icon: '📦' },
];

// Pricing reference
const PRICING = { 1: 249, 2: 449, 3: 649 };
const EXTRA_100_PAGES = 80; // per album

export default function App() {
  const [isLoggedIn, setIsLoggedIn]       = useState(false);
  const [checkingAuth, setCheckingAuth]   = useState(true);
  const [activeNav, setActiveNav]         = useState('home');
  const [workflowStep, setWorkflowStep]   = useState(0);

  const [selectedOrder,    setSelectedOrder]    = useState(null);
  const [albumConfigs,     setAlbumConfigs]     = useState(null);
  const [albumPhotos,      setAlbumPhotos]      = useState({});
  const [currentAlbumIdx,  setCurrentAlbumIdx]  = useState(0);
  const [isGenerating,     setIsGenerating]     = useState(false);
  const [generatedResults, setGeneratedResults] = useState(null);

  useEffect(() => {
    api.auth.check()
      .then(d => { if (d?.authenticated) setIsLoggedIn(true); })
      .catch(() => {})
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLoginSuccess = () => setIsLoggedIn(true);

  const handleLogout = async () => {
    await api.auth.logout();
    setIsLoggedIn(false);
    setSelectedOrder(null);
    setWorkflowStep(0);
    setActiveNav('home');
  };

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setAlbumPhotos({});
    setCurrentAlbumIdx(0);
    setGeneratedResults(null);
    setWorkflowStep(1);
    setActiveNav('orders');
  };

  const handleConfigComplete = async (config) => {
    try {
      // Sync order to DB to retrieve UUIDs for albums
      const dbData = await api.orders.sync({ order: selectedOrder, albums: config.albums });
      config.albums = config.albums.map((a, i) => ({ ...a, id: dbData.albums[i].id }));
    } catch (err) {
      alert("Failed to sync order to DB: " + err.message);
      return;
    }
    setAlbumConfigs(config);
    setWorkflowStep(2);
    setCurrentAlbumIdx(0);
  };

  const handlePhotosComplete = (photos) => {
    // This is called per album, but currently the UI just updates state and doesn't auto-advance
    // The "Proceed" button handles advancement
  };
  
  const proceedToPlacements = () => {
    setWorkflowStep(3);
    setCurrentAlbumIdx(0);
  };

  const handlePlacementsComplete = (placements) => {
    // Move to next album 
    if (currentAlbumIdx < albumConfigs.albums.length - 1) {
      setCurrentAlbumIdx(currentAlbumIdx + 1);
    } else {
      setWorkflowStep(4);
      setCurrentAlbumIdx(0);
    }
  };

  const handleTextsComplete = (texts) => {
    if (currentAlbumIdx < albumConfigs.albums.length - 1) {
      setCurrentAlbumIdx(currentAlbumIdx + 1);
    } else {
      setWorkflowStep(5); // Proceed to Preview
      setCurrentAlbumIdx(0);
    }
  };

  const handlePreviewComplete = () => {
    if (currentAlbumIdx < albumConfigs.albums.length - 1) {
      setCurrentAlbumIdx(currentAlbumIdx + 1);
    } else {
      setWorkflowStep(6); // Proceed to Generate
      setCurrentAlbumIdx(0);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: albumConfigs, photos: albumPhotos })
      });
      const data = await response.json();
      if (data.success) {
        setGeneratedResults(data.results);
        setWorkflowStep(4);
      } else {
        alert('Generation failed: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleZipDownload = async (result) => {
    try {
      const res = await fetch('http://localhost:3001/api/generate/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coverUrl: result.coverUrl,
          interiorUrl: result.interiorUrl,
          orderId: albumConfigs.orderNumber,
          clientName: albumConfigs.clientName,
          albumName: result.albumName
        })
      });
      if (!res.ok) throw new Error('ZIP failed');
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${albumConfigs.orderNumber}_${albumConfigs.clientName}_${result.albumName}.zip`.replace(/[^a-z0-9._-]/gi, '_');
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) { alert(err.message); }
  };

  // ── Auth loading ────────────────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg-primary)' }}>
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (!isLoggedIn) return <LoginGate onLoginSuccess={handleLoginSuccess} />;

  // ── Determine what the main area shows ─────────────────────────────────────
  const inWorkflow = activeNav === 'orders' && workflowStep > 0 && selectedOrder;

  return (
    <div className="app-shell animate-fade-in">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="brand mb-10">
          <div className="brand-logo">📖</div>
          <div>
            <h1 className="brand-name">Mosaïq Studio</h1>
            <span className="text-muted" style={{ fontSize: '11px' }}>Album Builder v2.0</span>
          </div>
        </div>

        {/* Main nav */}
        <nav className="sidebar-nav mb-6">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${activeNav === item.id && !inWorkflow && item.id !== 'orders' ? 'active' : ''} ${inWorkflow && item.id === 'orders' ? 'active' : ''}`}
              onClick={() => {
                setActiveNav(item.id);
                if (item.id === 'orders' && !selectedOrder) setWorkflowStep(0);
              }}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Workflow progress — only shown when in an order */}
        {inWorkflow && (
          <div className="workflow-progress">
            <div className="text-[10px] uppercase tracking-widest text-muted font-semibold mb-3 px-2">Progress</div>
            {WORKFLOW_STEPS.map(step => (
              <div key={step.id} className={`workflow-step ${workflowStep === step.id ? 'active' : ''} ${workflowStep > step.id ? 'done' : ''}`}>
                <div className="workflow-step-dot">
                  {workflowStep > step.id ? '✓' : step.icon}
                </div>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Active order mini-card */}
        {inWorkflow && (
          <div className="active-order-card">
            <div className="text-[10px] uppercase tracking-widest text-muted mb-1">Active Order</div>
            <div className="font-bold text-accent">#{selectedOrder.orderNumber}</div>
            <div className="text-xs text-muted truncate">{selectedOrder.firstName} {selectedOrder.lastName}</div>
            {albumConfigs && (
              <div className="text-[10px] mt-2 text-muted">
                Album {Math.min(currentAlbumIdx + 1, albumConfigs.albums.length)} / {albumConfigs.albums.length}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          <button className="btn btn-secondary btn-block" onClick={handleLogout} style={{ fontSize: '13px' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="main-content">
        <div className="view-container">

          {/* HOME DASHBOARD */}
          {activeNav === 'home' && (
            <HomeDashboard onNewOrder={() => { setActiveNav('orders'); setWorkflowStep(0); }} onArchive={() => setActiveNav('archive')} />
          )}

          {/* ORDERS / WORKFLOW */}
          {activeNav === 'orders' && (
            <>
              {workflowStep === 0 && <OrderPanel onOrderSelect={handleSelectOrder} />}

              {workflowStep === 1 && selectedOrder && (
                <AlbumConfig
                  order={selectedOrder}
                  onComplete={handleConfigComplete}
                  onBack={() => setWorkflowStep(0)}
                />
              )}

              {workflowStep === 2 && albumConfigs && (
                <div>
                  <div className="section-header mb-6">
                    <div>
                      <h2 className="section-title">Upload Photos</h2>
                      <p className="section-subtitle">
                        Please provide photos for all {albumConfigs.albums.length} album{albumConfigs.albums.length !== 1 ? 's' : ''}.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-8 mb-8">
                    {albumConfigs.albums.map((album, idx) => (
                      <div key={idx} className="album-photo-slot relative">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent font-bold text-sm">
                            {idx + 1}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">
                              {(album.destination?.name || `Album ${idx + 1}`).replace(/\s+\d+$/, '')}
                            </h3>
                            <div className="text-xs text-muted">{album.pageCount || 60} pages</div>
                          </div>
                        </div>

                        {albumPhotos[idx] ? (
                          <div className="glass-card p-8 text-center border-2 border-green-500/30 bg-green-500/5">
                            <div className="text-4xl mb-3">✅</div>
                            <h3 className="font-bold text-xl mb-1">Upload Complete</h3>
                            <p className="text-sm text-green-200 mb-4">{albumPhotos[idx].length} photos successfully uploaded.</p>
                            <button className="btn btn-secondary btn-sm" onClick={() => {
                              const newPhotos = { ...albumPhotos };
                              delete newPhotos[idx];
                              setAlbumPhotos(newPhotos);
                            }}>
                              ✎ Edit Photos
                            </button>
                          </div>
                        ) : (
                          <PhotoUploader
                            orderId={selectedOrder.orderNumber}
                            albumIndex={idx}
                            pageCount={album.pageCount || 60}
                            onComplete={(photos) => {
                              setAlbumPhotos(prev => ({ ...prev, [idx]: photos }));
                            }}
                            onBack={null} // Handle back at the master level below
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-6 pt-6 border-t border-white/10">
                    <button className="btn btn-secondary" onClick={() => setWorkflowStep(1)}>← Back to Config</button>
                    <button 
                      className="btn btn-primary btn-lg" 
                      disabled={Object.keys(albumPhotos).length < albumConfigs.albums.length}
                      onClick={proceedToPlacements}
                    >
                      {Object.keys(albumPhotos).length < albumConfigs.albums.length 
                        ? `Complete ${albumConfigs.albums.length - Object.keys(albumPhotos).length} more album(s)`
                        : 'Proceed to Placements →'}
                    </button>
                  </div>
                </div>
              )}

              {workflowStep === 3 && albumConfigs && (
                <div className="mt-6">
                  {albumConfigs.albums.map((album, idx) => (
                    idx === currentAlbumIdx && (
                      <PlacementEditor
                        key={album.id}
                        orderId={selectedOrder.orderNumber}
                        album={album}
                        photos={albumPhotos[idx] || []}
                        onComplete={handlePlacementsComplete}
                        onBack={() => {
                          if (currentAlbumIdx > 0) setCurrentAlbumIdx(currentAlbumIdx - 1);
                          else setWorkflowStep(2);
                        }}
                      />
                    )
                  ))}
                  
                  <div className="flex gap-2 justify-center mt-4 mb-8">
                     {albumConfigs.albums.map((_, i) => (
                       <div key={i} className={`w-2 h-2 rounded-full ${i === currentAlbumIdx ? 'bg-accent' : i < currentAlbumIdx ? 'bg-green-500' : 'bg-white/20'}`} />
                     ))}
                  </div>
                </div>
              )}

              {workflowStep === 4 && albumConfigs && (
                <div className="mt-6">
                  {albumConfigs.albums.map((album, idx) => (
                    idx === currentAlbumIdx && (
                      <TextEditor
                        key={album.id}
                        order={selectedOrder}
                        album={album}
                        onComplete={handleTextsComplete}
                        onBack={() => {
                          if (currentAlbumIdx > 0) setCurrentAlbumIdx(currentAlbumIdx - 1);
                          else setWorkflowStep(3); // Go back to Placements
                        }}
                      />
                    )
                  ))}
                  
                  <div className="flex gap-2 justify-center mt-4 mb-8">
                     {albumConfigs.albums.map((_, i) => (
                       <div key={i} className={`w-2 h-2 rounded-full ${i === currentAlbumIdx ? 'bg-accent' : i < currentAlbumIdx ? 'bg-green-500' : 'bg-white/20'}`} />
                     ))}
                  </div>
                </div>
              )}

              {workflowStep === 5 && albumConfigs && (
                <div className="mt-6">
                  {albumConfigs.albums.map((album, idx) => (
                    idx === currentAlbumIdx && (
                      <FlipbookPreview
                        key={album.id}
                        album={album}
                        onComplete={handlePreviewComplete}
                        onBack={() => {
                          if (currentAlbumIdx > 0) setCurrentAlbumIdx(currentAlbumIdx - 1);
                          else setWorkflowStep(4); // Go back to Texts
                        }}
                      />
                    )
                  ))}
                  
                  <div className="flex gap-2 justify-center mt-4 mb-8">
                     {albumConfigs.albums.map((_, i) => (
                       <div key={i} className={`w-2 h-2 rounded-full ${i === currentAlbumIdx ? 'bg-accent' : i < currentAlbumIdx ? 'bg-green-500' : 'bg-white/20'}`} />
                     ))}
                  </div>
                </div>
              )}

              {workflowStep === 6 && albumConfigs && (
                <GenerateScreen
                  albumConfigs={albumConfigs}
                  albumPhotos={albumPhotos}
                  isGenerating={isGenerating}
                  onGenerate={handleGenerate}
                  onBack={() => setWorkflowStep(2)}
                />
              )}

              {workflowStep === 7 && generatedResults && (
                <ExportScreen
                  results={generatedResults}
                  albumConfigs={albumConfigs}
                  onZip={handleZipDownload}
                  onNewOrder={() => { setWorkflowStep(0); setSelectedOrder(null); }}
                  onArchive={() => setActiveNav('archive')}
                />
              )}
            </>
          )}

          {/* ARCHIVE */}
          {activeNav === 'archive' && <ArchivePanel />}

          {/* SETTINGS */}
          {activeNav === 'settings' && <BrandingSettings />}

        </div>
      </main>
    </div>
  );
}

// ── Home Dashboard ───────────────────────────────────────────────────────────
function HomeDashboard({ onNewOrder, onArchive }) {
  return (
    <div className="animate-fade-in">
      <div className="home-hero">
        <div className="home-hero-badge">📖 Mosaïq Studio</div>
        <h1 className="home-hero-title">Album Production<br/><span className="text-gradient">Pipeline</span></h1>
        <p className="home-hero-sub">
          Import Shopify orders, configure albums, upload photos, and generate print-ready PDFs — all in one place.
        </p>
        <div className="home-hero-actions">
          <button className="btn btn-primary btn-lg" onClick={onNewOrder}>
            🛒 Start New Order
          </button>
          <button className="btn btn-secondary btn-lg" onClick={onArchive}>
            🗄️ View Archive
          </button>
        </div>
      </div>

      <div className="home-features-grid">
        {[
          { icon: '🛒', title: 'Shopify Sync',    desc: 'Pull orders live. Financial & fulfilment status shown per order.' },
          { icon: '🗺️', title: 'Smart Mapping',   desc: 'Destination is auto-detected from Shopify notes or line items.' },
          { icon: '📸', title: 'Photo Grid',       desc: 'Upload photos. The engine places them in random aesthetic layouts.' },
          { icon: '📄', title: 'Print-Ready PDF',  desc: 'A4 cover + interior generated at 300 DPI, ready for your printer.' },
          { icon: '📦', title: 'ZIP Packaging',    desc: 'Bundle cover + interior into a named ZIP — one click to send.' },
          { icon: '🗄️', title: 'Archive Library',  desc: 'Find every generated album by order number or client name.' },
        ].map(f => (
          <div key={f.title} className="feature-card glass-card p-6">
            <div className="feature-icon">{f.icon}</div>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="home-pricing glass-card p-6 mt-8">
        <h3 className="font-bold text-lg mb-4">💰 Pricing Reference</h3>
        <div className="pricing-grid">
          {[
            { label: '1 Album (60p)', price: '249 MAD' },
            { label: '2 Albums (60p)', price: '449 MAD' },
            { label: '3 Albums (60p)', price: '649 MAD' },
            { label: '+ 100-page upgrade', price: '+80 MAD / album' },
          ].map(p => (
            <div key={p.label} className="pricing-item">
              <span className="text-muted text-sm">{p.label}</span>
              <span className="font-bold text-accent">{p.price}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Generate Screen ──────────────────────────────────────────────────────────
function GenerateScreen({ albumConfigs, albumPhotos, isGenerating, onGenerate, onBack }) {
  const photoTotals = albumConfigs.albums.map((_, i) => (albumPhotos[i] || []).length);
  const grandTotal  = photoTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="empty-state animate-fade-in">
      <div className={`text-5xl mb-6 ${isGenerating ? 'animate-spin' : ''}`}>🏗️</div>
      <h2 className="empty-state-title">{isGenerating ? 'Generating PDFs…' : 'Ready to Assemble'}</h2>
      <p className="empty-state-text">
        {isGenerating
          ? 'Photos are being embedded. This may take a minute.'
          : `${albumConfigs.albums.length} album(s) · ${grandTotal} photos total`}
      </p>

      <div className="glass-card p-6 mt-8 w-full max-w-lg text-left">
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-muted">Client</span>
          <span className="font-bold">{albumConfigs.clientName}</span>
        </div>
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-muted">Order</span>
          <span className="font-bold text-accent">#{albumConfigs.orderNumber}</span>
        </div>
        <div className="border-t border-white/10 mt-3 pt-3 flex flex-col gap-2">
          {albumConfigs.albums.map((album, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-muted">Album {i + 1} — {(album.destination?.name || '?').replace(/\s+\d+$/, '')}</span>
              <span>{photoTotals[i] || 0} photos · {album.pageCount}p</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-6">
          <button className="btn btn-secondary" onClick={onBack} disabled={isGenerating}>Back</button>
          <button className="btn btn-primary flex-1" onClick={onGenerate} disabled={isGenerating}>
            {isGenerating ? 'Processing…' : '🚀 Start PDF Assembly'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Export Screen ────────────────────────────────────────────────────────────
function ExportScreen({ results, albumConfigs, onZip, onNewOrder, onArchive }) {
  return (
    <div className="animate-fade-in">
      <div className="section-header mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">✅</span>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Generation Complete</h2>
          </div>
          <p className="section-subtitle">{results.length} album(s) ready to print for Order #{albumConfigs.orderNumber}</p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary btn-sm" onClick={onArchive}>View in Archive</button>
          <button className="btn btn-secondary btn-sm" onClick={onNewOrder}>New Order</button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {results.map((res, i) => (
          <div key={i} className="glass-card p-6 bg-white/5">
            <div className="flex justify-between items-center mb-5">
              <div>
                <div className="font-bold text-lg">{res.albumName}</div>
                <div className="text-xs text-muted">A4 Hardcover · Print-Ready PDF Package</div>
              </div>
              <div className="flex flex-col gap-2 w-48">
                <button onClick={() => onZip(res)} className="btn btn-primary btn-sm flex items-center justify-center gap-2 font-bold">
                  📦 Download ZIP
                </button>
                <div className="flex gap-2">
                  <a href={res.coverUrl}   download target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm flex-1 text-center text-xs">Cover</a>
                  <a href={res.interiorUrl} download target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm flex-1 text-center text-xs">Pages</a>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted uppercase tracking-widest font-semibold mb-2">Cover Preview</div>
                <iframe src={res.coverUrl + '#toolbar=0&navpanes=0&scrollbar=0'} className="w-full rounded border border-white/10" style={{ height: '280px' }} title="Cover" />
              </div>
              <div>
                <div className="text-xs text-muted uppercase tracking-widest font-semibold mb-2">Interior Preview</div>
                <iframe src={res.interiorUrl + '#toolbar=0&navpanes=0&scrollbar=0'} className="w-full rounded border border-white/10" style={{ height: '280px' }} title="Interior" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
