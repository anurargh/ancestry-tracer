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
    if (!window.confirm('Are you sure you want to remove this media attachment?')) {
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
        return { label: 'Photo', color: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/40' };
      case 'certificate':
        return { label: 'Certificate', color: 'bg-blue-950/70 text-blue-300 border-blue-800/40' };
      case 'census_record':
        return { label: 'Census Record', color: 'bg-amber-950/70 text-amber-300 border-amber-800/40' };
      case 'document':
        return { label: 'Document', color: 'bg-purple-950/70 text-purple-300 border-purple-800/40' };
      default:
        return { label: 'Archival', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  return (
    <div id="person_media_gallery" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Media & Archival Documents ({media.length})
          </h4>
          <p className="text-xs text-slate-400">
            Attached primary sources, portraits, and census schedules with cryptographic SHA-256 provenance.
          </p>
        </div>
        {canEdit && (
          <button
            id="attach_media_btn"
            onClick={onOpenUpload}
            className="px-3 py-1.5 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm shadow-indigo-950/40"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Attach Media
          </button>
        )}
      </div>

      {/* Media Grid */}
      {media.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center bg-slate-950/20">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="text-sm text-slate-400">No photos or documents attached yet.</p>
          {canEdit && (
            <button
              onClick={onOpenUpload}
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Upload portrait, certificate, or census schedule
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {media.map((item) => {
            const badge = getMediaBadge(item.mediaType);
            const isImage = item.mimeType?.startsWith('image/') || item.mediaType === 'photo';

            return (
              <div
                key={item.mediaId}
                className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl overflow-hidden flex flex-col group transition-all"
              >
                {/* Thumbnail Preview / Icon */}
                <div
                  onClick={() => setSelectedMedia(item)}
                  className="h-36 bg-slate-950 relative flex items-center justify-center cursor-pointer overflow-hidden border-b border-slate-800/80"
                >
                  {isImage ? (
                    <img
                      src={item.fileUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-slate-400">
                      <FileText className="w-10 h-10 text-indigo-400" />
                      <span className="text-[11px] font-mono uppercase text-slate-500">
                        {item.mimeType?.split('/')[1] || 'DOC'}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="px-2.5 py-1 bg-slate-900/90 text-slate-200 text-xs rounded-lg border border-slate-700 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> View
                    </span>
                  </div>

                  {/* Top Badge */}
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-medium border ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Card Details */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h5
                      onClick={() => setSelectedMedia(item)}
                      className="text-xs font-semibold text-slate-200 line-clamp-1 cursor-pointer hover:text-indigo-400 transition-colors"
                      title={item.title}
                    >
                      {item.title}
                    </h5>
                    {item.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>

                  {/* SHA-256 Checksum Provenance Tag */}
                  <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1 text-slate-400 truncate max-w-[170px]">
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="font-mono truncate" title={item.sha256Checksum}>
                        {item.sha256Checksum.slice(0, 12)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copyChecksum(item.sha256Checksum, item.mediaId)}
                        title="Copy full SHA-256 Checksum"
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        {copiedId === item.mediaId ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          disabled={deletingId === item.mediaId}
                          onClick={() => handleDelete(item.mediaId)}
                          title="Delete media"
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedMedia && (
        <div
          id="media_preview_modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-medium border ${
                    getMediaBadge(selectedMedia.mediaType).color
                  }`}
                >
                  {getMediaBadge(selectedMedia.mediaType).label}
                </span>
                <h3 className="text-sm font-semibold text-slate-100">{selectedMedia.title}</h3>
              </div>
              <button
                onClick={() => setSelectedMedia(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Media Content */}
              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 max-h-[420px] flex items-center justify-center">
                {selectedMedia.mimeType?.startsWith('image/') || selectedMedia.mediaType === 'photo' ? (
                  <img
                    src={selectedMedia.fileUrl}
                    alt={selectedMedia.title}
                    className="max-h-[420px] w-auto object-contain"
                  />
                ) : (
                  <div className="p-12 text-center space-y-3">
                    <FileText className="w-16 h-16 mx-auto text-indigo-400" />
                    <p className="text-sm text-slate-300 font-medium">{selectedMedia.title}</p>
                    <a
                      href={selectedMedia.fileUrl}
                      download={selectedMedia.title}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Download Document
                    </a>
                  </div>
                )}
              </div>

              {/* Descriptions & Metadata */}
              {selectedMedia.description && (
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                  <p className="text-xs font-medium text-slate-400 mb-1">Archival Notes / Context</p>
                  <p className="text-xs text-slate-200 leading-relaxed">{selectedMedia.description}</p>
                </div>
              )}

              {/* SHA-256 Provenance Box */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    SHA-256 Cryptographic Checksum (Integrity & Provenance)
                  </span>
                  <button
                    onClick={() => copyChecksum(selectedMedia.sha256Checksum, 'modal')}
                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                  >
                    {copiedId === 'modal' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copiedId === 'modal' ? 'Copied' : 'Copy Hash'}
                  </button>
                </div>
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-200 break-all">
                  {selectedMedia.sha256Checksum}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Uploaded by: {selectedMedia.uploadedBy || 'Authenticated User'}</span>
                  <span>
                    {selectedMedia.uploadedAt ? new Date(selectedMedia.uploadedAt).toLocaleString() : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
