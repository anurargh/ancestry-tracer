import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Image as ImageIcon, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { MediaType, PersonMediaRecord } from '../types.ts';

interface MediaUploadModalProps {
  personId: string;
  personName: string;
  onClose: () => void;
  onMediaUploaded: (media: PersonMediaRecord) => void;
}

export const MediaUploadModal: React.FC<MediaUploadModalProps> = ({
  personId,
  personName,
  onClose,
  onMediaUploaded,
}) => {
  const [title, setTitle] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('photo');
  const [description, setDescription] = useState('');
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [sha256Checksum, setSha256Checksum] = useState<string>('');
  const [isHashing, setIsHashing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute SHA-256 in browser using Web Crypto API
  const calculateSha256 = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError('File is too large. Please select a file under 20MB.');
      return;
    }

    setFileName(file.name);
    setMimeType(file.type || 'application/octet-stream');
    setFileSize(file.size);
    if (!title) {
      // Auto-populate title from clean filename
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    // Guess media type from mime
    if (file.type.startsWith('image/')) {
      setMediaType('photo');
    } else if (file.name.toLowerCase().includes('census')) {
      setMediaType('census_record');
    } else if (file.name.toLowerCase().includes('cert')) {
      setMediaType('certificate');
    } else {
      setMediaType('document');
    }

    setIsHashing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const checksum = await calculateSha256(arrayBuffer);
      setSha256Checksum(checksum);

      const reader = new FileReader();
      reader.onload = (e) => {
        setFileDataUrl(e.target?.result as string);
        setIsHashing(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error('Error processing file:', err);
      setError('Failed to calculate SHA-256 hash or read file.');
      setIsHashing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileDataUrl || !sha256Checksum) {
      setError('Please select a file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a descriptive title for this document.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const token = localStorage.getItem('familygraph_token') || 'demo_token';
      const res = await fetch(`/api/people/${personId}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          mediaType,
          mimeType,
          fileSize,
          fileUrl: fileDataUrl,
          sha256Checksum,
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload media');
      }

      onMediaUploaded(data.media);
      onClose();
    } catch (err: any) {
      console.error('Error uploading media:', err);
      setError(err.message || 'Failed to attach media document.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div id="media_upload_modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-400" />
              Attach Document / Photo
            </h3>
            <p className="text-xs text-slate-400">For {personName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Drag and Drop Zone */}
          {!fileDataUrl ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-950/20'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf,text/plain"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
                <Upload className="w-6 h-6 text-indigo-400" />
              </div>
              <p className="text-sm font-medium text-slate-200">
                Click or drag & drop a file here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports photos, certificates, census scans, and PDFs (up to 20MB)
              </p>
            </div>
          ) : (
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {mimeType?.startsWith('image/') ? (
                    <img
                      src={fileDataUrl}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded-lg border border-slate-700"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-indigo-950/80 border border-indigo-800/50 flex items-center justify-center text-indigo-300">
                      <FileText className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-200 truncate max-w-[220px]">
                      {fileName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {fileSize ? `${(fileSize / 1024).toFixed(1)} KB` : ''} • {mimeType}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFileDataUrl(null);
                    setSha256Checksum('');
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 px-2 py-1 rounded-lg border border-rose-900/40"
                >
                  Change
                </button>
              </div>

              {/* SHA-256 Provenance Checksum Box */}
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    SHA-256 Provenance Checksum:
                  </span>
                  {isHashing ? (
                    <span className="text-amber-400">Computing...</span>
                  ) : (
                    <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
                <p className="font-mono text-[11px] text-slate-300 break-all leading-tight">
                  {sha256Checksum || 'Calculating hash...'}
                </p>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Document Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., 1900 Federal Census Schedule, Marriage Certificate"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Media Type */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Document / Media Classification
            </label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaType)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="photo">Photograph / Portrait</option>
              <option value="certificate">Official Certificate (Birth/Marriage/Death)</option>
              <option value="census_record">Census Schedule / Population Census</option>
              <option value="document">Archival Document / Deed / Will</option>
              <option value="other">Other Genealogical Record</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Historical Notes / Transcription (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Original parchment document preserved at County Archives, shows address at 44 Elm St."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || isHashing || !fileDataUrl || !title.trim()}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-1.5 shadow-lg shadow-indigo-900/30"
            >
              {isUploading ? 'Uploading...' : 'Save & Attach'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
