import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { api } from '../utils/api';

export default function PhotoUploader({ orderId, orderDbId, albumId, albumIndex, pageCount = 60, onComplete, onBack }) {
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draggedItem, setDraggedItem] = useState(null);

  // Load photos from DB on mount
  useEffect(() => {
    async function loadPhotos() {
      setPhotos([]);
      if (!orderDbId || !albumId) {
        // Fallback: load from storage directly (legacy path)
        await loadFromStorage();
        return;
      }

      try {
        const dbPhotos = await api.photos.list(orderDbId, albumId);
        if (dbPhotos && dbPhotos.length > 0) {
          const mapped = dbPhotos.map((p, i) => ({
            file: null,
            id: p.id,
            dbId: p.id,
            name: p.file_name || `Photo ${i + 1}`,
            preview: p.public_url,
            url: p.public_url,
            storagePath: p.storage_path,
            status: p.status === 'committed' ? 'Committed' : 'Uploaded',
            quality: 'Pushed to Cloud',
            width: p.original_width || 0,
            height: p.original_height || 0,
            position: p.position,
            expiresAt: p.expires_at,
            dbStatus: p.status
          }));
          setPhotos(mapped);
        }
      } catch (err) {
        console.warn('[PhotoUploader] DB load failed, falling back to storage:', err.message);
        await loadFromStorage();
      }
    }

    async function loadFromStorage() {
      try {
        const directory = `${orderId}/album_${albumIndex}`;
        const { data, error } = await supabase.storage.from('photos').list(`client-photos/${directory}`);
        
        if (data && data.length > 0) {
           const existing = data
              .filter(file => file.name && !file.name.startsWith('.')) 
              .map(file => {
                const { data: urlData } = supabase.storage.from('photos').getPublicUrl(`client-photos/${directory}/${file.name}`);
                return {
                   file: null,
                   id: file.id || file.name,
                   name: file.name,
                   preview: urlData.publicUrl,
                   url: urlData.publicUrl,
                   status: 'Uploaded',
                   quality: 'Pushed to Cloud'
                };
            });
           setPhotos(existing);
        }
      } catch (err) {
        console.error('Failed to load photos from storage:', err);
      }
    }

    loadPhotos();
  }, [orderId, orderDbId, albumId, albumIndex]);

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index.toString());
    }
  };

  const handleDropOnItem = async (e, targetIndex) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === targetIndex) return;

    const items = [...photos];
    const [reorderedItem] = items.splice(draggedItem, 1);
    items.splice(targetIndex, 0, reorderedItem);
    
    setPhotos(items);
    setDraggedItem(null);

    // Persist new positions to DB if we have DB-backed photos
    const updates = items
      .filter(p => p.dbId)
      .map((p, idx) => ({ id: p.dbId, position: idx }));

    if (updates.length > 0) {
      try {
        await api.photos.reorder(updates);
      } catch (err) {
        console.warn('[PhotoUploader] Reorder save failed:', err.message);
      }
    }
  };

  const checkDPI = (width, height) => {
    const targetWidth = 2480;
    const targetHeight = 3508;
    const isLowRes = width < (targetWidth / 2) || height < (targetHeight / 2);
    return isLowRes ? 'Low Resolution' : 'Good Quality';
  };

  const handleFiles = (files) => {
    const newPhotos = Array.from(files).map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      preview: URL.createObjectURL(file),
      status: 'Pending',
      quality: 'Checking...',
      width: 0,
      height: 0
    }));

    setPhotos(prev => [...prev, ...newPhotos]);

    // Update quality check asynchronously
    newPhotos.forEach(photo => {
      const img = new Image();
      img.onload = () => {
        setPhotos(prev => prev.map(p => p.id === photo.id ? { 
          ...p, 
          width: img.width, 
          height: img.height, 
          quality: checkDPI(img.width, img.height) 
        } : p));
      };
      img.src = photo.preview;
    });
  };

  const removePhoto = async (id) => {
    const photo = photos.find(p => p.id === id);
    
    // Delete from DB if it's a DB-backed photo
    if (photo?.dbId) {
      try {
        await api.photos.delete(photo.dbId);
      } catch (err) {
        console.warn('[PhotoUploader] DB delete failed:', err.message);
      }
    }

    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const compressImage = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 3508;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height / width) * maxDim);
            width = maxDim;
          } else {
            width = Math.round((width / height) * maxDim);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.90);
      };
      img.src = url;
    });
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires - now;
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const startUpload = async () => {
    if (photos.length === 0) return;
    setUploading(true);
    let completed = 0;

    try {
      const uploadedAssets = [];
      const updatedPhotos = [...photos];

      for (let i = 0; i < updatedPhotos.length; i++) {
        const photo = updatedPhotos[i];

        if ((photo.status === 'Uploaded' || photo.status === 'Committed') && photo.url) {
          uploadedAssets.push({
            id: photo.dbId || photo.id,
            url: photo.url,
            name: photo.name,
            width: photo.width,
            height: photo.height
          });
          completed++;
          setProgress(Math.round((completed / updatedPhotos.length) * 100));
          continue;
        }

        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'Uploading...' } : p));

        let fileToUpload = photo.file;
        let fileExt = photo.file.name.split('.').pop().toLowerCase();
        let mimeType = photo.file.type;

        // Smart Compression: if photo > 5MB, cleanly re-encode it
        if (photo.file.size > 5 * 1024 * 1024 && photo.file.type.startsWith('image/')) {
          console.log(`Compressing ${photo.file.name} (${Math.round(photo.file.size / 1024 / 1024)}MB)`);
          const compressedBlob = await compressImage(photo.preview);
          fileToUpload = compressedBlob;
          fileExt = 'jpg';
          mimeType = 'image/jpeg';
        }

        const fileName = `${orderId}/album_${albumIndex}/${photo.id}.${fileExt}`;
        const filePath = `client-photos/${fileName}`;

        // Create a 60 second timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Upload timeout (60s). Network might be unstable.')), 60000)
        );
        
        const uploadOptions = { upsert: true, contentType: mimeType };
        const uploadPromise = supabase.storage.from('photos').upload(filePath, fileToUpload, uploadOptions);

        const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);
        if (error) throw error;

        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(filePath);
        const publicUrl = urlData.publicUrl;

        // Register in DB if we have order/album IDs
        let dbId = null;
        if (orderDbId && albumId) {
          try {
            const dbPhoto = await api.photos.register({
              orderId: orderDbId,
              albumId: albumId,
              storagePath: filePath,
              publicUrl: publicUrl,
              fileName: photo.name,
              width: photo.width || 0,
              height: photo.height || 0,
              position: i
            });
            dbId = dbPhoto.id;
          } catch (regErr) {
            console.warn('[PhotoUploader] DB register failed:', regErr.message);
          }
        }

        photo.url = publicUrl;
        photo.dbId = dbId;
        photo.status = 'Uploaded';

        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, status: 'Uploaded', url: publicUrl, dbId } : p));

        uploadedAssets.push({
          id: dbId || photo.id,
          url: publicUrl,
          name: photo.name,
          width: photo.width,
          height: photo.height
        });

        completed++;
        setProgress(Math.round((completed / updatedPhotos.length) * 100));
      }
      onComplete(uploadedAssets);
    } catch (err) {
      console.error(err);
      alert(`Upload paused at ${progress}%. Error: ${err.message}\n\nYou can click inside the prompt or just click "Proceed" again to resume the upload safely without starting over.`);
    } finally {
      setUploading(false);
    }
  };

  const [isGlobalDragging, setIsGlobalDragging] = useState(false);

  const handleGlobalDragOver = (e) => {
    e.preventDefault();
    setIsGlobalDragging(true);
  };
  const handleGlobalDragLeave = (e) => {
    e.preventDefault();
    setIsGlobalDragging(false);
  };
  const handleGlobalDrop = (e) => {
    e.preventDefault();
    setIsGlobalDragging(false);
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div 
      className={`photo-uploader animate-fade-in relative transition-all ${isGlobalDragging ? 'ring-4 ring-accent-primary ring-inset rounded-lg' : ''}`}
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
    >
      {isGlobalDragging && (
         <div className="absolute inset-0 z-50 bg-bg-dark/80 backdrop-blur-sm flex items-center justify-center rounded-lg pointer-events-none border-2 border-dashed border-accent-primary">
           <div className="text-center text-accent-primary animate-pulse">
             <div className="text-6xl mb-4">📸</div>
             <h3 className="text-2xl font-bold">Drop Photos Here</h3>
           </div>
         </div>
      )}

      <div className="glass-card p-8 text-center mb-8 border-dashed border-2 border-accent-primary" 
           onDragOver={(e) => e.preventDefault()}
           onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
        <div className="text-4xl mb-4">📸</div>
        <h3 className="text-xl font-bold mb-2">Drag & Drop Photos</h3>
        <p className="text-sm text-muted mb-4">
          Upload client photos for this <strong className="text-white">{pageCount}-page</strong> album layout.<br/>
          <span className="text-accent inline-block mt-2 font-bold px-3 py-1 bg-accent/10 rounded border border-accent/20 shadow-lg">
            Requirement: {pageCount} to {Math.round(pageCount * 1.5)} photos to fulfill structural density organically.
          </span>
        </p>
        <label className="btn btn-secondary pointer">
          Browse Files
          <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </label>
      </div>


      {photos.length > 0 && (
        <div className="photo-grid-container glass-card p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold">{photos.length} Photos {photos.some(p => p.status === 'Pending') ? 'Pending' : 'Ready'}</h3>
            <button className="btn btn-danger btn-sm" onClick={() => setPhotos([])}>Clear All</button>
          </div>
          
          <div className="scroll-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
              {photos.map((photo, index) => (
                <div 
                  key={photo.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropOnItem(e, index)}
                  className="photo-card relative bg-black/40 rounded border border-white/10 hover:border-accent transition-colors overflow-hidden group cursor-move shadow-sm aspect-square flex items-center justify-center"
                >
                  <div className="absolute top-1.5 left-1.5 z-10 w-6 h-6 rounded bg-accent/90 backdrop-blur-sm text-white flex items-center justify-center text-[11px] font-bold shadow-lg border border-white/20 select-none">
                    {index + 1}
                  </div>

                  {/* Status badge */}
                  {photo.dbStatus === 'pending' && photo.expiresAt && (
                    <div className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded bg-amber-500/80 backdrop-blur-sm text-white text-[9px] font-bold shadow-lg border border-amber-400/30 select-none">
                      ⏳ {getTimeRemaining(photo.expiresAt)}
                    </div>
                  )}
                  {photo.dbStatus === 'committed' && (
                    <div className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded bg-green-500/80 backdrop-blur-sm text-white text-[9px] font-bold shadow-lg border border-green-400/30 select-none">
                      ✓ Saved
                    </div>
                  )}

                  <img src={photo.preview} alt="preview" className="w-full h-full object-cover drag-none pointer-events-none transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center backdrop-blur-md">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mb-2 ${photo.quality === 'Low Resolution' ? 'bg-red-500/80 border border-red-400' : 'bg-green-500/80 border border-green-400'}`}>
                      {photo.quality}
                    </span>
                    <button className="text-white hover:text-red-300 text-xs font-semibold px-3 py-1 bg-red-500/30 rounded border border-red-500/50 hover:bg-red-500/60 transition-all pointer-events-auto" onClick={() => removePhoto(photo.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {uploading && (
        <div className="upload-progress glass-card p-6 mb-8">
          <div className="flex justify-between mb-2">
            <span>Uploading Assets...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div className="bg-accent-primary h-full rounded-full transition-all" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}

      <div className="step-actions flex justify-between mt-4">
        {onBack ? (
          <button className="btn btn-secondary" onClick={onBack} disabled={uploading}>Back to Config</button>
        ) : <div />}
        <button className="btn btn-primary" onClick={startUpload} disabled={photos.length === 0 || uploading}>
          {uploading ? `Uploading (${progress}%)` : `Upload ${photos.length} Photos`}
        </button>
      </div>
    </div>
  );
}
