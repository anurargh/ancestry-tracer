import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  History,
  Shield,
  Search,
  Filter,
  RefreshCw,
  GitCommit,
  ArrowRight,
  Database,
  User,
  Clock,
  Layers,
  ChevronLeft,
  ChevronRight,
  Code,
  FileText,
  Link,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  FolderGit2,
  Scroll,
  BookOpen,
} from 'lucide-react';
import { AuditLogRecord } from '../types.ts';
import { motion } from 'motion/react';

export const AuditLogPage: React.FC = () => {
  const { getAuthHeaders, user } = useAuth();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [stats, setStats] = useState({
    totalClaims: 0,
    totalRelationships: 0,
    totalMerges: 0,
    totalMedia: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const pageSize = 25;

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      if (entityFilter !== 'all') params.append('entityType', entityFilter);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', pageSize.toString());
      params.append('offset', (page * pageSize).toString());

      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch audit logs');
      }

      setLogs(data.logs || []);
      setTotal(data.total || 0);

      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'Failed to load institutional audit ledger.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, actionFilter, page, user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'insert':
      case 'create':
        return { label: 'INSERT', style: 'border-[#4C7A5E] bg-[#162A1F] text-[#85C49F]' };
      case 'supersede':
        return { label: 'SUPERSEDE', style: 'border-[#3F648A] bg-[#142332] text-[#8DB4DB]' };
      case 'merge':
        return { label: 'MERGE', style: 'border-[#D4AF37] bg-[#1A1813] text-[#D4AF37]' };
      case 'delete':
        return { label: 'DELETE', style: 'border-[#9C4A3C] bg-[#2A1513] text-[#EBB4AC]' };
      case 'update':
      default:
        return { label: 'UPDATE', style: 'border-[#2B333C] bg-[#101317] text-[#F4EDE2]' };
    }
  };

  const formatEntityTitle = (type: string) => {
    switch (type) {
      case 'person_claim':
        return 'Person Sourced Claim';
      case 'parent_child':
        return 'Parent-Child Kinship Edge';
      case 'partnership':
        return 'Spousal Partnership Edge';
      case 'match_candidate':
        return 'Duplicate Reconciliation Dossier';
      case 'person_media':
        return 'Primary Archival Media';
      case 'person':
        return 'Person Record Entity';
      default:
        return type;
    }
  };

  const renderJsonDiff = (oldVal: any, newVal: any) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#D4AF37]/20 text-xs font-sans">
        <div className="bg-[#101317] p-4 rounded-sm border border-[#2B333C]">
          <span className="text-[10px] font-mono font-bold text-[#EBB4AC] uppercase tracking-widest block mb-2">
            PREVIOUS STATE (OLD_VALUE)
          </span>
          {oldVal ? (
            <pre className="font-mono text-[11px] text-[#A69B8D] whitespace-pre-wrap overflow-x-auto leading-relaxed">
              {JSON.stringify(oldVal, null, 2)}
            </pre>
          ) : (
            <span className="text-[#64707D] italic font-serif text-xs">Record did not exist prior to this event.</span>
          )}
        </div>

        <div className="bg-[#101317] p-4 rounded-sm border border-[#2B333C]">
          <span className="text-[10px] font-mono font-bold text-[#85C49F] uppercase tracking-widest block mb-2">
            RESULTING STATE (NEW_VALUE)
          </span>
          {newVal ? (
            <pre className="font-mono text-[11px] text-[#F4EDE2] whitespace-pre-wrap overflow-x-auto leading-relaxed">
              {JSON.stringify(newVal, null, 2)}
            </pre>
          ) : (
            <span className="text-[#64707D] italic font-serif text-xs">Record deleted or expunged from database.</span>
          )}
        </div>
      </div>
    );
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div id="audit_ledger_page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 font-sans">
      {/* Art Deco Marquee Header */}
      <div className="relative border-b-2 border-[#D4AF37]/30 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1A1813] border border-[#D4AF37]/40 text-[#D4AF37] text-[10px] font-mono uppercase tracking-[0.2em]">
              <span className="w-1.5 h-1.5 bg-[#D4AF37] rotate-45"></span>
              IMMUTABLE CHRONOLOGY & PROVENANCE • FOLIO № 400
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-[#F4EDE2] tracking-tight uppercase">
            Institutional Audit Ledger
          </h1>
          <p className="text-sm font-serif text-[#C4B59D] mt-1.5 max-w-2xl leading-relaxed italic">
            Cryptographically verifiable accession journal recording every evidentiary assertion insertion, claim supersession, identity merge, and kinship tree transformation.
          </p>
        </div>

        <button
          id="refresh_audit_ledger_btn"
          onClick={fetchLogs}
          className="inline-flex items-center gap-2.5 bg-[#15191E] hover:bg-[#1C222A] text-[#F4EDE2] border border-[#D4AF37]/40 px-5 py-2.5 rounded-sm text-xs font-display uppercase tracking-wider transition-colors shadow-sm shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Ledger Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="deco-card bg-[#15191E] border border-[#D4AF37]/30 p-5 rounded-sm space-y-1.5">
          <div className="text-[10px] uppercase font-mono text-[#8C8275] tracking-wider">Sourced Claims</div>
          <div className="text-2xl font-display font-bold text-[#F4EDE2]">
            {stats.totalClaims || '—'}
          </div>
        </div>

        <div className="deco-card bg-[#15191E] border border-[#D4AF37]/30 p-5 rounded-sm space-y-1.5">
          <div className="text-[10px] uppercase font-mono text-[#8C8275] tracking-wider">Kinship Edges</div>
          <div className="text-2xl font-display font-bold text-[#F4EDE2]">
            {stats.totalRelationships || '—'}
          </div>
        </div>

        <div className="deco-card bg-[#15191E] border border-[#D4AF37]/30 p-5 rounded-sm space-y-1.5">
          <div className="text-[10px] uppercase font-mono text-[#8C8275] tracking-wider">Reconciled Merges</div>
          <div className="text-2xl font-display font-bold text-[#D4AF37]">
            {stats.totalMerges || '0'}
          </div>
        </div>

        <div className="deco-card bg-[#15191E] border border-[#D4AF37]/30 p-5 rounded-sm space-y-1.5">
          <div className="text-[10px] uppercase font-mono text-[#8C8275] tracking-wider">Archival Documents</div>
          <div className="text-2xl font-display font-bold text-[#85C49F]">
            {stats.totalMedia || '0'}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="deco-card p-4 space-y-3 bg-[#15191E] border border-[#D4AF37]/30 rounded-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8C8275] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit journal by entity UUID, curator persona ID, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#101317] border border-[#D4AF37]/30 rounded-sm text-xs text-[#F4EDE2] placeholder:text-[#64707D] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 bg-[#101317] border border-[#D4AF37]/30 px-3 py-2 rounded-sm">
              <span className="text-[#8C8275] font-mono text-[10px] uppercase">Entity:</span>
              <select
                value={entityFilter}
                onChange={(e) => {
                  setEntityFilter(e.target.value);
                  setPage(0);
                }}
                className="bg-transparent text-[#F4EDE2] font-mono text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-[#15191E]">All Entities</option>
                <option value="person_claim" className="bg-[#15191E]">Evidentiary Claims</option>
                <option value="parent_child" className="bg-[#15191E]">Parent-Child Edges</option>
                <option value="partnership" className="bg-[#15191E]">Partnership Edges</option>
                <option value="match_candidate" className="bg-[#15191E]">Duplicate Candidates</option>
                <option value="person_media" className="bg-[#15191E]">Archival Documents</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-[#101317] border border-[#D4AF37]/30 px-3 py-2 rounded-sm">
              <span className="text-[#8C8275] font-mono text-[10px] uppercase">Action:</span>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(0);
                }}
                className="bg-transparent text-[#F4EDE2] font-mono text-xs focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-[#15191E]">All Actions</option>
                <option value="insert" className="bg-[#15191E]">Insert</option>
                <option value="supersede" className="bg-[#15191E]">Supersede</option>
                <option value="merge" className="bg-[#15191E]">Merge</option>
                <option value="delete" className="bg-[#15191E]">Delete</option>
              </select>
            </div>
          </div>
        </form>
      </div>

      {/* Audit Log Ledger Table */}
      <div className="deco-card border-2 border-[#D4AF37]/30 bg-[#15191E] rounded-sm overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-10 h-10 rounded-sm border-2 border-[#D4AF37]/30 border-t-[#D4AF37] animate-spin mx-auto"></div>
            <p className="text-xs font-mono text-[#C4B59D] uppercase tracking-widest">
              Extracting immutable journal entries from cryptographic ledger...
            </p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-[#EBB4AC] bg-[#2A1513]">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-xs font-serif text-[#8C8275]">
            No audit ledger entries match the selected filter parameters.
          </div>
        ) : (
          <div className="divide-y divide-[#2B333C]">
            {logs.map((log) => {
              const badge = getActionBadge(log.action);
              const isExpanded = expandedLogId === log.logId;

              return (
                <div
                  key={log.logId}
                  id={`audit_log_row_${log.logId}`}
                  className="p-5 hover:bg-[#1A1F26] transition-colors"
                >
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.logId)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-sm border font-bold tracking-wider ${badge.style}`}>
                        {badge.label}
                      </span>

                      <div>
                        <div className="font-display font-bold text-sm text-[#F4EDE2]">
                          {formatEntityTitle(log.entityType)}
                        </div>
                        <div className="text-[10px] text-[#8C8275] font-mono">
                          REGISTRY UUID: {log.entityId.slice(0, 18).toUpperCase()}...
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs font-mono text-[#A69B8D]">
                      <div className="text-right">
                        <div className="text-[#F4EDE2]">Curator: {log.actorId.replace('user-', '')}</div>
                        <div className="text-[10px] text-[#8C8275]">
                          {new Date(log.timestamp).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </div>
                      </div>
                      <span className="text-xs font-display uppercase tracking-wider text-[#D4AF37] px-2 py-1 bg-[#101317] border border-[#D4AF37]/30 rounded-sm">
                        {isExpanded ? 'Collapse Diff' : 'Examine Diff'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded JSON State Diff */}
                  {isExpanded && renderJsonDiff(log.oldValue, log.newValue)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-[#A69B8D] font-mono">
          <div>
            Showing entries {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total} in ledger
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 border border-[#D4AF37]/30 rounded-sm hover:bg-[#15191E] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[#D4AF37]" />
            </button>
            <span className="px-3 font-display uppercase tracking-wider text-[#F4EDE2]">
              Folio {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 border border-[#D4AF37]/30 rounded-sm hover:bg-[#15191E] disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
