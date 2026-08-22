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
} from 'lucide-react';
import { AuditLogRecord } from '../types.ts';

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

      // Compute stats
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      setError(err.message || 'Failed to load audit logs.');
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
        return { label: 'INSERT', bg: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60' };
      case 'supersede':
        return { label: 'SUPERSEDE', bg: 'bg-purple-950/80 text-purple-300 border-purple-800/60' };
      case 'merge':
        return { label: 'MERGE', bg: 'bg-blue-950/80 text-blue-300 border-blue-800/60' };
      case 'delete':
        return { label: 'DELETE', bg: 'bg-rose-950/80 text-rose-300 border-rose-800/60' };
      case 'update':
      default:
        return { label: 'UPDATE', bg: 'bg-amber-950/80 text-amber-300 border-amber-800/60' };
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'person_claim':
        return <FileText className="w-4 h-4 text-purple-400" />;
      case 'parent_child':
      case 'partnership':
        return <Link className="w-4 h-4 text-emerald-400" />;
      case 'match_candidate':
        return <Users className="w-4 h-4 text-blue-400" />;
      case 'person_media':
        return <FolderGit2 className="w-4 h-4 text-amber-400" />;
      default:
        return <Database className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatEntityTitle = (type: string) => {
    switch (type) {
      case 'person_claim':
        return 'Person Claim';
      case 'parent_child':
        return 'Parent-Child Edge';
      case 'partnership':
        return 'Partnership Edge';
      case 'match_candidate':
        return 'Duplicate Candidate';
      case 'person_media':
        return 'Media Document';
      case 'person':
        return 'Person Record';
      default:
        return type;
    }
  };

  const renderJsonDiff = (oldVal: any, newVal: any) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-800 text-xs">
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block mb-1">
            Previous State (old_value)
          </span>
          {oldVal ? (
            <pre className="font-mono text-[11px] text-slate-300 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(oldVal, null, 2)}
            </pre>
          ) : (
            <span className="text-slate-500 italic">null (Record did not exist)</span>
          )}
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
            New State (new_value)
          </span>
          {newVal ? (
            <pre className="font-mono text-[11px] text-slate-300 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(newVal, null, 2)}
            </pre>
          ) : (
            <span className="text-slate-500 italic">null (Record was deleted)</span>
          )}
        </div>
      </div>
    );
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div id="audit_log_page" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-300 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Administrative Audit
            </span>
            <span className="text-xs text-slate-500 font-mono">table: audit_log</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            System Audit & Mutation Trail
          </h1>
          <p className="text-sm text-slate-400">
            Immutable log recording every insert, update, supersession, merge, and deletion across claims, relationships, and candidate merges.
          </p>
        </div>

        <button
          onClick={() => {
            setPage(0);
            fetchLogs();
          }}
          disabled={isLoading}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 border border-slate-700 shadow-sm shrink-0 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Log
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            Total Recorded Events
          </span>
          <p className="text-2xl font-bold text-slate-100 mt-1">{total}</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-purple-400" />
            Claim Mutations
          </span>
          <p className="text-2xl font-bold text-purple-300 mt-1">{stats.totalClaims || 0}</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Link className="w-4 h-4 text-emerald-400" />
            Graph Edge Updates
          </span>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{stats.totalRelationships || 0}</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-400" />
            Candidate Merges
          </span>
          <p className="text-2xl font-bold text-blue-300 mt-1">{stats.totalMerges || 0}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by entity ID, user UID/email, or data values..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </form>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {/* Entity Type Filter */}
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(0);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Entity Types</option>
              <option value="person_claim">person_claim (Claims)</option>
              <option value="parent_child">parent_child (Lineage Edges)</option>
              <option value="partnership">partnership (Spousal Edges)</option>
              <option value="match_candidate">match_candidate (Merges)</option>
              <option value="person_media">person_media (Media Files)</option>
              <option value="person">person (Profiles)</option>
            </select>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(0);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Actions</option>
              <option value="insert">INSERT (Create)</option>
              <option value="update">UPDATE</option>
              <option value="supersede">SUPERSEDE</option>
              <option value="merge">MERGE</option>
              <option value="delete">DELETE</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Stream */}
      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
          <p className="text-sm text-slate-400">Loading audit log entries from Cloud SQL...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl space-y-2">
          <History className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm text-slate-300 font-medium">No audit entries found</p>
          <p className="text-xs text-slate-500">
            {searchQuery || entityFilter !== 'all' || actionFilter !== 'all'
              ? 'Try relaxing your filters or search query.'
              : 'As data is added or modified in the tree, audit entries will be recorded here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const actionBadge = getActionBadge(log.action);
            const isExpanded = expandedLogId === log.logId;

            return (
              <div
                key={log.logId}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${actionBadge.bg}`}
                    >
                      {actionBadge.label}
                    </span>

                    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      {getEntityIcon(log.entityType)}
                      <span className="font-mono text-[11px] text-slate-400">{log.entityType}</span>
                    </span>

                    <span className="text-xs text-slate-400 font-mono">
                      ID: <span className="text-slate-300 font-semibold">{log.entityId}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-mono text-[11px] text-indigo-300">{log.changedBy}</span>
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      {log.changedAt ? new Date(log.changedAt).toLocaleString() : ''}
                    </span>
                  </div>
                </div>

                {/* Quick Summary or Toggle Details */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="text-xs text-slate-400 flex items-center gap-2 truncate max-w-xl">
                    {log.action === 'supersede' && (
                      <span className="text-purple-300">
                        Claim marked superseded by higher confidence/priority claim
                      </span>
                    )}
                    {log.action === 'merge' && (
                      <span className="text-blue-300">
                        Duplicate candidate merged into canonical record
                      </span>
                    )}
                    {log.action === 'insert' && (
                      <span className="text-emerald-300">
                        New {formatEntityTitle(log.entityType)} established
                      </span>
                    )}
                    {log.action === 'delete' && (
                      <span className="text-rose-300">
                        {formatEntityTitle(log.entityType)} removed from graph
                      </span>
                    )}
                    {log.action === 'update' && (
                      <span className="text-amber-300">
                        Record state updated
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedLogId(isExpanded ? null : log.logId)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium shrink-0 ml-2"
                  >
                    <Code className="w-3.5 h-3.5" />
                    {isExpanded ? 'Hide Payload Diff' : 'View Payload Diff'}
                  </button>
                </div>

                {/* Expanded Snapshot Inspector */}
                {isExpanded && renderJsonDiff(log.oldValue, log.newValue)}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-400">
            Showing <span className="font-medium text-slate-200">{page * pageSize + 1}</span> to{' '}
            <span className="font-medium text-slate-200">
              {Math.min((page + 1) * pageSize, total)}
            </span>{' '}
            of <span className="font-medium text-slate-200">{total}</span> audit records
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || isLoading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 font-mono px-2">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1 || isLoading}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
