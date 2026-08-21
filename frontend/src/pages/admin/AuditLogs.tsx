import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getAuditLogs, type AuditLogRecord } from '../../services/auditService';
import AppHeader from '../../components/layout/AppHeader';

const PAGE_SIZE = 25;

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
};

const formatMoney = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '—';

  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) return String(value);

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(numericValue);
};

const formatChangeText = (record: AuditLogRecord): string => {
  const { action, entity_type, old_value, new_value } = record;

  if (entity_type === 'PRICING') {
    const oldRate = typeof old_value?.rate === 'string' || typeof old_value?.rate === 'number' ? old_value.rate : null;
    const newRate = typeof new_value?.rate === 'string' || typeof new_value?.rate === 'number' ? new_value.rate : null;

    if (oldRate !== null && newRate !== null) {
      return `${formatMoney(oldRate)} → ${formatMoney(newRate)}`;
    }

    if (newRate !== null) {
      return `→ ${formatMoney(newRate)}`;
    }

    return 'Pricing updated';
  }

  if (entity_type === 'DOCTOR') {
    const oldName = typeof old_value?.name === 'string' ? old_value.name : '';
    const newName = typeof new_value?.name === 'string' ? new_value.name : '';

    if (action === 'CREATE') return newName || 'New Doctor';
    if (action === 'DEACTIVATE' || action === 'ACTIVATE') return oldName || newName || 'Doctor';
    if (oldName && newName && oldName !== newName) return `${oldName} → ${newName}`;
    return 'Doctor updated';
  }

  if (entity_type === 'SERVICE') {
    const oldServiceName = typeof old_value?.service_name === 'string' ? old_value.service_name : '';
    const newServiceName = typeof new_value?.service_name === 'string' ? new_value.service_name : '';
    const oldCost = typeof old_value?.cost_per_day === 'string' || typeof old_value?.cost_per_day === 'number' ? old_value.cost_per_day : null;
    const newCost = typeof new_value?.cost_per_day === 'string' || typeof new_value?.cost_per_day === 'number' ? new_value.cost_per_day : null;
    const oldActive = typeof old_value?.active === 'boolean' ? old_value.active : undefined;
    const newActive = typeof new_value?.active === 'boolean' ? new_value.active : undefined;

    if (action === 'CREATE') {
      return newServiceName || 'New Service';
    }

    if (action === 'DEACTIVATE') {
      return oldServiceName || newServiceName || 'Service';
    }

    if (action === 'ACTIVATE') {
      return oldServiceName || newServiceName || 'Service';
    }

    if (oldCost !== null && newCost !== null) {
      return `${formatMoney(oldCost)}/day → ${formatMoney(newCost)}/day`;
    }

    if (oldServiceName && newServiceName && oldServiceName !== newServiceName) {
      return `${oldServiceName} → ${newServiceName}`;
    }

    if (oldActive !== undefined && newActive !== undefined) {
      return `${String(oldActive)} → ${String(newActive)}`;
    }

    return 'Service updated';
  }

  return 'Updated';
};

const getInitialFilterState = (search: URLSearchParams): {
  entityType: 'All' | 'PRICING' | 'SERVICE' | 'DOCTOR';
  action: 'All' | 'CREATE' | 'UPDATE' | 'ACTIVATE' | 'DEACTIVATE';
} => {
  const entityType = search.get('entityType');
  const action = search.get('action');

  return {
    entityType: entityType === 'PRICING' || entityType === 'SERVICE' || entityType === 'DOCTOR' ? entityType : 'All',
    action: action === 'CREATE' || action === 'UPDATE' || action === 'ACTIVATE' || action === 'DEACTIVATE' ? action : 'All',
  };
};

function AuditLogs() {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [entityTypeFilter, setEntityTypeFilter] = useState<'All' | 'PRICING' | 'SERVICE' | 'DOCTOR'>(() => getInitialFilterState(searchParams).entityType);
  const [actionFilter, setActionFilter] = useState<'All' | 'CREATE' | 'UPDATE' | 'ACTIVATE' | 'DEACTIVATE'>(() => getInitialFilterState(searchParams).action);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await getAuditLogs({
          entityType: entityTypeFilter === 'All' ? undefined : entityTypeFilter,
          action: actionFilter === 'All' ? undefined : actionFilter,
        });

        setLogs(data);
      } catch {
        setError('Unable to load audit logs. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchLogs();
  }, [entityTypeFilter, actionFilter]);

  useEffect(() => {
    setPage(1);
  }, [entityTypeFilter, actionFilter]);

  const adminOptions = useMemo(() => {
    const uniqueAdmins = new Map<string, string>();

    logs.forEach((log) => {
      if (!uniqueAdmins.has(log.admin_username)) {
        uniqueAdmins.set(log.admin_username, log.admin_username);
      }
    });

    return ['All', ...Array.from(uniqueAdmins.values())];
  }, [logs]);

  const [adminFilter, setAdminFilter] = useState<'All' | string>('All');

  useEffect(() => {
    setAdminFilter('All');
  }, [entityTypeFilter, actionFilter]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesEntity = entityTypeFilter === 'All' || log.entity_type === entityTypeFilter;
      const matchesAction = actionFilter === 'All' || log.action === actionFilter;
      const matchesAdmin = adminFilter === 'All' || log.admin_username === adminFilter;
      return matchesEntity && matchesAction && matchesAdmin;
    });
  }, [logs, entityTypeFilter, actionFilter, adminFilter]);

  const totalRecords = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalRecords);
  const currentPageLogs = filteredLogs.slice(startIndex, endIndex);

  const handleFilterChange = (nextEntityType: 'All' | 'PRICING' | 'SERVICE' | 'DOCTOR', nextAction: 'All' | 'CREATE' | 'UPDATE' | 'ACTIVATE' | 'DEACTIVATE') => {
    const params = new URLSearchParams();
    if (nextEntityType !== 'All') params.set('entityType', nextEntityType);
    if (nextAction !== 'All') params.set('action', nextAction);

    navigate({ pathname: '/admin/audit-logs', search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });

    setEntityTypeFilter(nextEntityType);
    setActionFilter(nextAction);
  };

  return (
    <>
      <AppHeader role="Admin" />
      <div className="legacy-admin-page app-page" style={{ minHeight: '100vh', background: '#f7f9fc', padding: '32px 24px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#0f172a' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569', fontWeight: 700 }}>Admin Portal</p>
              <h1 style={{ margin: '10px 0 0', fontSize: '2rem' }}>Audit History</h1>
            </div>

            <button
              type="button"
              onClick={() => navigate('/admin')}
              style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer' }}
            >
              ← Back to Dashboard
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
            <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
              <span>Section</span>
              <select
                value={entityTypeFilter}
                onChange={(event) => handleFilterChange(event.target.value as 'All' | 'PRICING' | 'SERVICE', actionFilter)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              >
                <option value="All">All</option>
                <option value="PRICING">Pricing</option>
                <option value="SERVICE">Services</option>
                <option value="DOCTOR">Doctors</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
              <span>Action</span>
              <select
                value={actionFilter}
                onChange={(event) => handleFilterChange(entityTypeFilter, event.target.value as 'All' | 'CREATE' | 'UPDATE' | 'ACTIVATE' | 'DEACTIVATE')}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              >
                <option value="All">All</option>
                <option value="CREATE">Created</option>
                <option value="UPDATE">Updated</option>
                <option value="ACTIVATE">Activated</option>
                <option value="DEACTIVATE">Deactivated</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
              <span>Admin</span>
              <select
                value={adminFilter}
                onChange={(event) => setAdminFilter(event.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a' }}
              >
                {adminOptions.map((option) => (
                  <option key={option} value={option}>{option === 'All' ? 'All admins' : option}</option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div style={{ marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '10px 12px', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Loading audit logs...</div>
          ) : currentPageLogs.length === 0 ? (
            <div style={{ border: '1px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', color: '#475569' }}>
              No audit entries match the selected filters.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12, color: '#475569', fontWeight: 600 }}>
                Showing {totalRecords === 0 ? 0 : startIndex + 1}–{endIndex} of {totalRecords} changes
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Date & Time</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Admin</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Section</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Record</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageLogs.map((log) => {
                      const actionLabel =
                        log.action === 'CREATE' ? 'Created' :
                        log.action === 'UPDATE' ? 'Updated' :
                        log.action === 'ACTIVATE' ? 'Activated' :
                        log.action === 'DEACTIVATE' ? 'Deactivated' : log.action;

                      const recordLabel = log.entity_type === 'PRICING' ? `#${log.entity_id}` : log.entity_type === 'SERVICE' ? `#${log.entity_id}` : `#${log.entity_id}`;

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 10px', color: '#334155' }}>{formatDateTime(log.created_at)}</td>
                          <td style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 600 }}>{log.admin_username}</td>
                          <td style={{ padding: '12px 10px', color: '#0f172a' }}>{actionLabel}</td>
                          <td style={{ padding: '12px 10px', color: '#0f172a' }}>{log.entity_type === 'PRICING' ? 'Pricing' : 'Service'}</td>
                          <td style={{ padding: '12px 10px', color: '#334155' }}>{recordLabel}</td>
                          <td style={{ padding: '12px 10px', color: '#0f172a' }}>{formatChangeText(log)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.6 : 1 }}
                >
                  Previous
                </button>

                <span style={{ color: '#475569', fontWeight: 600 }}>Page {safePage} of {totalPages}</span>

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', opacity: safePage >= totalPages ? 0.6 : 1 }}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

export default AuditLogs;
