import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { X, Upload, ShieldCheck, FileText, Image as ImageIcon, AlertCircle, Scroll } from 'lucide-react';
import { motion } from 'motion/react';
import { MediaType } from '../types.ts';

interface MediaUploadModalProps {
  personId: string;
  personName: string;
  onClose: () => void;
  onMediaUploaded: () => void;
}

export const MediaUploadModal: React.FC<MediaUploadModalProps> = ({
  personId,
  personName,
  onClose,
  onMediaUploaded,
}) => {
  const { getAuthHeaders } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('certificate');
  const [fileUrl, setFileUrl] = useState('');
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [fileData, setFileData] = useState<{
    base64: string;
    mimeType: string;
    size: number;
    checksum: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute SHA-256 Checksum using browser Web Crypto API
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);

      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const reader = new FileReader();
      reader.onload = () => {
        setFileData({
          base64: reader.result as string,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          checksum: hashHex,
        });
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('File hashing error:', err);
      setError('Failed to compute cryptographic SHA-256 fingerprint.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a document title for the archival register.');
      return;
    }

    if (!isUrlMode && !fileData) {
      setError('Please select an archival file or switch to direct URL accession.');
      return;
    }

    if (isUrlMode && !fileUrl.trim()) {
      setError('Please enter a valid document file URL.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = await getAuthHeaders();

      let targetUrl = fileUrl;
      let checksum = fileData?.checksum || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      let mime = fileData?.mimeType || 'application/pdf';
      let size = fileData?.size || 0;

      if (!isUrlMode && fileData) {
        targetUrl = fileData.base64;
      }

      const res = await fetch(`/api/people/${personId}/media`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          mediaType,
          fileUrl: targetUrl,
          sha256Checksum: checksum,
          mimeType: mime,
          fileSize: size,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to accession archival document');
      }

      onMediaUploaded();
      onClose();
    } catch (err: any) {
      console.error('Failed to attach document:', err);
      setError(err.message || 'Error accessioning document into vault');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="deco-card bg-[#15191E] border-2 border-[#D4AF37] rounded-sm w-full max-w-xl max-h-[90vh] flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.8)] my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#D4AF37]/30 bg-[#120F0B]">
          <div>
            <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-1.5">
              <Scroll className="w-3.5 h-3.5" />
              <span>PRIMARY SOURCE PROVENANCE ARCHIVE</span>
            </div>
            <h2 className="text-xl font-display font-bold text-[#F4EDE2] mt-0.5 uppercase tracking-wide">
              Accession Document for {personName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm text-[#8C8275] hover:text-[#F4EDE2] hover:bg-[#1A1F26] transition-colors border border-transparent hover:border-[#D4AF37]/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs font-sans">
          {error && (
            <div className="p-3.5 rounded-sm border border-[#9C4A3C]/60 bg-[#2A1513] text-[#EBB4AC] font-serif">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Document Title / Accession Label</label>
            <input
              type="text"
              required
              placeholder="e.g., Parish Marriage Register 1888, Folio 42"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] font-display text-sm font-semibold"
            />
          </div>

          {/* Media Archetype */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Document Archetype</label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaType)}
              className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] cursor-pointer font-sans"
            >
              <option value="certificate" className="bg-[#15191E]">Official Vital Certificate (Birth, Marriage, Death)</option>
              <option value="census_record" className="bg-[#15191E]">Federal / National Census Schedule</option>
              <option value="photo" className="bg-[#15191E]">Historical Photograph / Daguerreotype</option>
              <option value="document" className="bg-[#15191E]">Probate, Testamentary Will, Military or Land Deed</option>
            </select>
          </div>

          {/* File Upload Mode Toggle */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-[#8C8275] font-mono text-[11px] uppercase">Accession Method:</span>
            <button
              type="button"
              onClick={() => setIsUrlMode(!isUrlMode)}
              className="text-[#D4AF37] hover:underline font-mono text-[11px] uppercase tracking-wider"
            >
              {isUrlMode ? 'Switch to Local Archival File Upload' : 'Switch to Direct Document URL'}
            </button>
          </div>

          {/* Upload Drop Zone / Input */}
          {!isUrlMode ? (
            <div className="space-y-2">
              <label className="block p-6 border-2 border-dashed border-[#D4AF37]/40 hover:border-[#D4AF37] rounded-sm cursor-pointer text-center bg-[#101317] transition-all group">
                <input
                  type="file"
                  onChange={handleFileSelect}
                  accept="image/*,application/pdf"
                  className="hidden"
                />
                <Upload className="w-8 h-8 mx-auto mb-2 text-[#D4AF37] group-hover:scale-110 transition-transform" />
                <div className="font-display font-bold text-xs uppercase tracking-wider text-[#F4EDE2]">
                  {fileData ? 'Archival File Loaded & Cryptographically Fingerprinted' : 'Click or Drag to Accession Primary Document'}
                </div>
                <div className="text-[10px] text-[#8C8275] mt-1 font-mono">
                  PNG, JPG, TIFF, or PDF (Web Crypto SHA-256 Calculated On-Client)
                </div>
              </label>

              {fileData && (
                <div className="p-3.5 bg-[#120F0B] border border-[#D4AF37]/30 rounded-sm space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#85C49F]">
                    <span className="flex items-center gap-1 font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      SHA-256 FINGERPRINT CALCULATED
                    </span>
                    <span className="text-[#C4B59D]">{Math.round(fileData.size / 1024)} KB</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#D4AF37] break-all bg-[#101317] p-2 rounded-sm border border-[#2B333C]">
                    {fileData.checksum}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Archival Document URL</label>
              <input
                type="url"
                placeholder="https://nationalarchives.gov/records/folio-192.pdf"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37] font-mono"
              />
            </div>
          )}

          {/* Archival Description / Annotation */}
          <div className="space-y-1.5">
            <label className="text-[#C4B59D] font-display uppercase tracking-wider text-[11px] font-medium">Archival Annotation / Physical Notes</label>
            <textarea
              rows={2}
              placeholder="Notes on official stamps, condition, signatures, repository box number..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-[#F4EDE2] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-[#D4AF37]/20">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[#A69B8D] hover:text-[#F4EDE2] font-display uppercase text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-b from-[#E6CA65] to-[#B88728] text-[#120F0B] font-display font-bold uppercase text-xs rounded-sm shadow-md transition-all active:scale-95 border border-[#F3E5AB]"
            >
              {loading ? 'Accessioning...' : 'Vault Archival Document'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
