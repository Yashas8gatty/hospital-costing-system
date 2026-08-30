import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { getBillingHistory, type BillingHistoryRecord } from '../../services/admin/billingHistoryService';
import AppHeader from '../../components/layout/AppHeader';

const PAGE_SIZE = 25;

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const formattedTime = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${formattedDate}, ${formattedTime}`;
};

const formatCurrency = (value: string | number): string => {
  const numericValue = Number(value);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
};

const formatLimbType = (value: string): string =>
  value === 'UNILATERAL' ? 'Unilateral' : 'Bilateral';

function BillingHistory() {
  const navigate = useNavigate();

  const [records, setRecords] = useState<BillingHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [billerFilter, setBillerFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'DRAFT' | 'FINAL'>('All');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchBillingHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getBillingHistory();
        setRecords(data);
      } catch {
        setError('Unable to load billing history. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchBillingHistory();
  }, []);

  // Extract unique billers for filtering (including deactivated ones)
  const uniqueBillers = useMemo(() => {
    const billersMap = new Map<string | number, string>();
    records.forEach((record) => {
      if (record.biller?.id && record.biller?.name) {
        billersMap.set(record.biller.id, record.biller.name);
      }
    });
    return Array.from(billersMap.entries()).map(([id, name]) => ({ id: String(id), name }));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        query.length === 0 ||
        record.patient_name.toLowerCase().includes(query) ||
        record.biller?.name?.toLowerCase().includes(query) ||
        record.doctor?.name?.toLowerCase().includes(query);

      const matchesBiller =
        billerFilter === 'All' || String(record.biller?.id) === billerFilter;

      const matchesStatus =
        statusFilter === 'All' || record.status === statusFilter;

      return matchesSearch && matchesBiller && matchesStatus;
    });
  }, [records, search, billerFilter, statusFilter]);

  const totalRecords = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalRecords);
  const currentPageRecords = filteredRecords.slice(startIndex, endIndex);

  const handleClearFilters = () => {
    setSearch('');
    setBillerFilter('All');
    setStatusFilter('All');
    setPage(1);
  };

  return (
    <>
      <AppHeader role="Admin" />
      <div className="legacy-admin-page app-page" style={{ minHeight: '100vh', background: '#f7f9fc', padding: '32px 24px', fontFamily: 'Segoe UI, Arial, sans-serif', color: '#0f172a' }}>
        <div style={{ maxWidth: 1300, margin: '0 auto' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 28, boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569', fontWeight: 700 }}>Admin Portal</p>
                <h1 style={{ margin: '10px 0 0', fontSize: '2rem' }}>Billing History</h1>
              </div>

              <button
                type="button"
                onClick={() => navigate('/admin')}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer' }}
              >
                ← Back to Dashboard
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
              <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
                <span>Search</span>
                <input
                  type="text"
                  placeholder="Patient, Biller or Doctor name"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontSize: 14 }}
                />
              </label>

              <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
                <span>Biller</span>
                <select
                  value={billerFilter}
                  onChange={(e) => {
                    setBillerFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontSize: 14 }}
                >
                  <option value="All">All Billers</option>
                  {uniqueBillers.map((biller) => (
                    <option key={biller.id} value={biller.id}>
                      {biller.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as 'All' | 'DRAFT' | 'FINAL');
                    setPage(1);
                  }}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', fontSize: 14 }}
                >
                  <option value="All">All Statuses</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="FINAL">FINAL</option>
                </select>
              </label>

              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  type="button"
                  onClick={handleClearFilters}
                  style={{ width: '100%', padding: '10px 16px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer' }}
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {error && (
              <div style={{ marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '10px 12px', fontWeight: 600 }}>
                {error}
              </div>
            )}

            {loading ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Loading billing history...</div>
            ) : currentPageRecords.length === 0 ? (
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', color: '#475569' }}>
                No billing entries match the selected filters.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12, color: '#475569', fontWeight: 600 }}>
                  Showing {totalRecords === 0 ? 0 : startIndex + 1}–{endIndex} of {totalRecords} bills
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 950 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>Date & Time</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>Biller</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>Patient</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>Doctor</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>Treatment</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>Total</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPageRecords.map((record) => {
                        const genderLabel = record.patient_gender
                          ? record.patient_gender === 'MALE' ? 'Male' : record.patient_gender === 'FEMALE' ? 'Female' : 'Other'
                          : '';

                        return (
                          <tr key={record.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '12px 10px', color: '#334155', fontSize: '0.9rem' }}>
                              {formatDateTime(record.created_at)}
                            </td>
                            <td style={{ padding: '12px 10px', fontSize: '0.9rem' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.biller?.name || 'Signatory unavailable'}</div>
                              {record.biller?.designation && (
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{record.biller.designation}</div>
                              )}
                            </td>
                            <td style={{ padding: '12px 10px', fontSize: '0.9rem' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.patient_name}</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                {record.patient_age} {genderLabel ? `· ${genderLabel}` : ''}
                              </div>
                            </td>
                            <td style={{ padding: '12px 10px', fontSize: '0.9rem' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{record.doctor?.name}</div>
                              {record.doctor?.designation && (
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{record.doctor.designation}</div>
                              )}
                            </td>
                            <td style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 500, fontSize: '0.9rem' }}>
                              {formatLimbType(record.limb_type)} · {record.volume} L · {record.duration_days} days
                            </td>
                            <td style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }}>
                              {formatCurrency(record.total_cost)}
                            </td>
                            <td style={{ padding: '12px 10px', fontSize: '0.9rem' }}>
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: 6,
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                background: record.status === 'FINAL' ? '#ecfdf5' : '#fef3c7',
                                color: record.status === 'FINAL' ? '#065f46' : '#92400e',
                                border: record.status === 'FINAL' ? '1px solid #a7f3d0' : '1px solid #fde68a'
                              }}>
                                {record.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 10px' }}>
                              <button
                                type="button"
                                onClick={() => navigate(`/doctor/report/${record.id}`)}
                                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                View
                              </button>
                            </td>
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

export default BillingHistory;
