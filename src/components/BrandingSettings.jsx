import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { supabase } from '../utils/supabaseClient';

export default function BrandingSettings() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [brandingUrl, setBrandingUrl] = useState('');

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    const { data } = supabase.storage.from('system-assets').getPublicUrl('interior_branding.pdf');
    if (data?.publicUrl) setBrandingUrl(data.publicUrl);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from('system-assets')
        .upload('interior_branding.pdf', file, { upsert: true });

      if (error) throw error;
      fetchBranding();
      alert('Interior Branded PDF updated successfully!');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="branding-settings animate-fade-in">
      <h2 className="section-title mb-2">System Branding</h2>
      <p className="section-subtitle mb-8">Manage global assets used in all generated albums.</p>

      <div className="glass-card p-6">
        <h3 className="text-lg font-bold mb-4">Interior Branded PDF</h3>
        <p className="text-sm text-muted mb-6">
          This PDF will be used as the first page (intro) for all interior PDF packages.
        </p>

        <div className="flex items-center gap-4">
          <label className="btn btn-secondary cursor-pointer">
            {file ? file.name : 'Select Branded PDF'}
            <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
          </label>
          <button className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? 'Uploading...' : 'Update Branding File'}
          </button>
        </div>

        {brandingUrl && (
          <div className="mt-6 p-4 bg-white/5 rounded-lg flex items-center justify-between">
            <span className="text-xs font-mono truncate max-w-md">{brandingUrl}</span>
            <a href={brandingUrl} target="_blank" rel="noreferrer" className="text-accent text-xs">Preview Current</a>
          </div>
        )}
      </div>
    </div>
  );
}
