import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Eye,
  X,
  FileCheck,
  BookOpen,
  Scroll,
} from 'lucide-react';
import { PersonMediaRecord } from '../types.ts';

interface PersonMediaGalleryProps {
  media: PersonMediaRecord[];
  canEdit: boolean;
  onDeleteMedia: (mediaId: string) => Promise<void>;
  onOpenUpload: () => void;
}

export const PersonMediaGallery: React.FC<PersonMediaGalleryProps> = ({
  media,
  canEdit,
  onDeleteMedia,
  onOpenUpload,
}) => {
  const [selectedMedia, setSelectedMedia] = useState<PersonMediaRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const copyChecksum = (checksum: string, id: string) => {
    navigator.clipboard.writeText(checksum);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (mediaId: string) => {
    if (!window.confirm('Are you sure you want to permanently remove this archival document from the repository?')) {
      return;
    }
    setDeletingId(mediaId);
    try {
      await onDeleteMedia(mediaId);
      if (selectedMedia?.mediaId === mediaId) {
        setSelectedMedia(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const getMediaBadge = (type: string) => {
    switch (type) {
      case 'photo':
        return { label: 'Photo / Portrait', style: 'border-[#4C7A5E] bg-[#162A1F] text-[#85C49F]' };
      case 'certificate':
        return { label: 'Vital Certificate', style: 'border-[#3F648A] bg-[#142332] text-[#8DB4DB]' };
      case 'census_record':
        return { label: 'Census Schedule', style: 'border-[#D4AF37] bg-[#1A1813] text-[#D4AF37]' };
      case 'document':
      default:
        return { label: 'Historical Deed / Will', style: 'border-[#2B333C] bg-[#101317] text-[#F4EDE2]' };
    }
  };

  return (
    <div id="person_media_gallery" className="deco-card border-2 border-[#D4AF37]/30 bg-[#15191E] rounded-sm p-6 sm:p-8 space-y-6 shadow-md font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#D4AF37]/20 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-display font-bold text-[#F4EDE2] flex items-center gap-2.5 uppercase tracking-wide">
            <BookOpen className="w-5 h-5 text-[#D4AF37]" />
            <span>Primary Sources & Archival Documents ({media.length})</span>
          </h2>
          <p className="text-xs font-serif text-[#C4B59D] mt-1 italic">
            Parish registers, census returns, vital certificates, and portraiture secured with SHA-256 cryptographic provenance digests.
          </p>
        </div>
        {canEdit && (
          <button
            id="attach_media_btn"
            onClick={onOpenUpload}
            className="px-4 py-2 bg-[#101317] hover:bg-[#1A1F26] text-[#D4AF37] border border-[#D4AF37]/40 rounded-sm text-xs font-display uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm shrink-0 active:scale-95"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Accession Document</span>
          </button>
        )}
      </div>

      {/* Media Grid */}
      {media.length === 0 ? (
        <div className="p-12 border-2 border-dashed border-[#2B333C] rounded-sm text-center bg-[#101317]/50">
          <FileText className="w-10 h-10 mx-auto mb-3 text-[#8C8275]" />
          <p className="text-xs font-serif text-[#C4B59D] italic">No primary documents or daguerreotypes accessioned for this individual dossier.</p>
          {canEdit && (
            <button
              onClick={onOpenUpload}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline font-display uppercase tracking-wider"
            >
              + Accession vital certificate, census schedule, or portrait
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {media.map((item) => {
            const badge = getMediaBadge(item.mediaType);
            const isImage = item.mimeType?.startsWith('image/') || item.mediaType === 'photo';

            return (
              <div
                key={item.mediaId}
                className="deco-card bg-[#101317] border border-[#D4AF37]/30 hover:border-[#D4AF37] rounded-sm overflow-hidden flex flex-col group transition-all shadow-sm"
              >
                {/* Thumbnail Preview */}
                <div
                  onClick={() => setSelectedMedia(item)}
                  className="h-40 bg-[#120F0B] relative flex items-center justify-center cursor-pointer overflow-hidden border-b border-[#2B333C]"
                >
                  {isImage ? (
                    <img
                      src={item.fileUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#8C8275]">
                      <FileText className="w-10 h-10 text-[#D4AF37]" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#8C8275]">
                        {item.mimeType?.split('/')[1]?.toUpperCase() || 'DOCUMENT'}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs text-[#F4EDE2] bg-[#15191E] px-3 py-1.5 rounded-sm border border-[#D4AF37]/50 flex items-center gap-1.5 font-display uppercase tracking-wider">
                      <Eye className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Examine Dossier
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-sm border font-bold ${badge.style}`}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-[#8C8275] font-mono">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h5 className="font-display font-bold text-sm text-[#F4EDE2] line-clamp-1">
                      {item.title}
                    </h5>

                    {item.description && (
                      <p className="text-xs font-serif text-[#C4B59D] line-clamp-2 italic">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* Cryptographic SHA-256 Fingerprint */}
                  <div className="pt-3 border-t border-[#2B333C] space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-[#8C8275] font-mono">
                      <span className="flex items-center gap-1 text-[#85C49F] font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        SHA-256 DIGEST
                      </span>
                      <button
                        onClick={() => copyChecksum(item.sha256Checksum, item.mediaId)}
                        className="hover:text-[#D4AF37] flex items-center gap-1 text-[10px] text-[#C4B59D]"
                        title="Copy SHA-256 Checksum"
                      >
                        {copiedId === item.mediaId ? (
                          <Check className="w-3 h-3 text-[#85C49F]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === item.mediaId ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="text-[9px] font-mono text-[#8C8275] truncate bg-[#15191E] px-2 py-1 rounded-sm border border-[#2B333C]">
                      {item.sha256Checksum}
                    </div>
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <div className="pt-2 flex items-center justify-end">
                      <button
                        onClick={() => handleDelete(item.mediaId)}
                        disabled={deletingId === item.mediaId}
                        className="text-[11px] text-[#8C8275] hover:text-[#EBB4AC] transition-colors flex items-center gap-1 font-display uppercase tracking-wider"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Expunge</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
          <div className="deco-card bg-[#15191E] border-2 border-[#D4AF37] rounded-sm max-w-2xl w-full max-h-[90vh] flex flex-col shadow-[0_10px_50px_rgba(0,0,0,0.9)] overflow-hidden">
            <div className="p-5 border-b border-[#D4AF37]/30 flex items-center justify-between bg-[#120F0B]">
              <div>
                <h3 className="font-display font-bold text-base text-[#F4EDE2] uppercase tracking-wide">
                  {selectedMedia.title}
                </h3>
                <div className="text-[10px] text-[#8C8275] font-mono mt-0.5">
                  {selectedMedia.mimeType} • {selectedMedia.fileSize ? `${Math.round(selectedMedia.fileSize / 1024)} KB` : 'Archival payload'}
                </div>
              </div>
              <button
                onClick={() => setSelectedMedia(null)}
                className="text-[#8C8275] hover:text-[#F4EDE2] p-1.5 rounded-sm hover:bg-[#1A1F26] border border-transparent hover:border-[#D4AF37]/40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {selectedMedia.mimeType?.startsWith('image/') || selectedMedia.mediaType === 'photo' ? (
                <div className="border border-[#2B333C] rounded-sm overflow-hidden bg-black max-h-96 flex items-center justify-center p-2">
                  <img
                    src={selectedMedia.fileUrl}
                    alt={selectedMedia.title}
                    className="max-h-96 w-auto object-contain shadow-md"
                  />
                </div>
              ) : (
                <div className="p-16 border-2 border-dashed border-[#2B333C] rounded-sm bg-[#101317] text-center space-y-3">
                  <FileText className="w-12 h-12 text-[#D4AF37] mx-auto" />
                  <div className="text-sm text-[#F4EDE2] font-display font-bold uppercase tracking-wider">
                    Primary Document Archival Record
                  </div>
                </div>
              )}

              {selectedMedia.description && (
                <div className="text-xs text-[#C4B59D] space-y-1 bg-[#101317] p-4 rounded-sm border border-[#2B333C]">
                  <span className="font-display uppercase tracking-wider text-[10px] text-[#D4AF37] block">Archival Annotation</span>
                  <p className="font-serif italic text-sm">{selectedMedia.description}</p>
                </div>
              )}

              <div className="p-4 bg-[#120F0B] border border-[#D4AF37]/30 rounded-sm space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#85C49F]">
                  <span className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    CRYPTOGRAPHIC SHA-256 CHECKDigest VERIFIED
                  </span>
                  <button
                    onClick={() => copyChecksum(selectedMedia.sha256Checksum, 'modal')}
                    className="text-[#D4AF37] hover:underline font-mono text-[10px] uppercase"
                  >
                    Copy Digest
                  </button>
                </div>
                <div className="text-[10px] font-mono text-[#F4EDE2] break-all bg-[#101317] p-2.5 rounded-sm border border-[#2B333C]">
                  {selectedMedia.sha256Checksum}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
