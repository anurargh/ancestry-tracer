import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  subtitle = 'ARCHIVAL GRAPH MODIFICATION',
  confirmLabel = 'Confirm Removal',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  error = null,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="deco-card bg-[#15191E] border-2 border-[#D4AF37] rounded-sm w-full max-w-md shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4AF37]/30 bg-[#120F0B]">
          <div>
            <div className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-[0.2em] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[#E0A848]" />
              <span>{subtitle}</span>
            </div>
            <h2 className="text-lg font-display font-bold text-[#F4EDE2] mt-0.5 uppercase tracking-wide">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-sm text-[#8C8275] hover:text-[#F4EDE2] hover:bg-[#1A1F26] transition-colors border border-transparent hover:border-[#D4AF37]/40 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-sm border border-[#9C4A3C]/60 bg-[#2A1513] text-[#EBB4AC] text-xs font-serif">
              {error}
            </div>
          )}

          <p className="text-sm font-serif text-[#C4B59D] leading-relaxed">
            {description}
          </p>

          <div className="p-3 rounded-sm bg-[#101317] border border-[#2B333C] text-[11px] text-[#8C8275] font-mono">
            ✦ All historical citations and source provenance will remain cataloged in the audit ledger.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2B333C] bg-[#120F0B]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-display uppercase tracking-wider text-[#8C8275] hover:text-[#F4EDE2] border border-[#2B333C] hover:border-[#D4AF37]/40 rounded-sm transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-display uppercase tracking-wider rounded-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 ${
              isDestructive
                ? 'bg-[#8A2424] hover:bg-[#A32E2E] text-white border border-[#C53030] shadow-sm'
                : 'bg-gradient-to-r from-[#D4AF37] to-[#B8972E] text-[#120F0B] hover:brightness-110'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                {isDestructive && <Trash2 className="w-3.5 h-3.5" />}
                <span>{confirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
