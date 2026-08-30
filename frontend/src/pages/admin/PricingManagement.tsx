import { useEffect, useMemo, useState } from 'react';

import { getAdminPricing, updatePricingRate } from '../../services/adminPricingService';
import type { PricingRate } from '../../types/pricing';
import AppHeader from '../../components/layout/AppHeader';

const PAGE_SIZE = 25;

const limbTypeOptions = ['All', 'UNILATERAL', 'BILATERAL'] as const;
const durationOptions = ['All', '7', '10', '14', '21'] as const;
const categoryOptions = ['All', '1', '2', '3', '4'] as const;

const formatCurrency = (value: string | number): string => {
  const numericValue = Number(value);

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
};

const getDurationLabel = (value: number): string => `${value} days`;

function PricingManagement() {
  const [records, setRecords] = useState<PricingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [limbTypeFilter, setLimbTypeFilter] = useState<'All' | 'UNILATERAL' | 'BILATERAL'>('All');
  const [durationFilter, setDurationFilter] = useState<'All' | '7' | '10' | '14' | '21'>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | '1' | '2' | '3' | '4'>('All');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRate, setDraftRate] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rateError, setRateError] = useState('');

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getAdminPricing();
        setRecords(data);
      } catch {
        setError('Unable to load pricing records. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchPricing();
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        record.volume_range.toLowerCase().includes(normalizedSearch) ||
        record.limb_type.toLowerCase().includes(normalizedSearch);

      const matchesLimbType =
        limbTypeFilter === 'All' || record.limb_type === limbTypeFilter;
      const matchesDuration =
        durationFilter === 'All' || String(record.duration_days) === durationFilter;
      const matchesCategory =
        categoryFilter === 'All' || String(record.financial_category) === categoryFilter;

      return matchesSearch && matchesLimbType && matchesDuration && matchesCategory;
    });
  }, [records, search, limbTypeFilter, durationFilter, categoryFilter]);

  const totalRecords = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safeCurrentPage = Math.min(page, totalPages);
  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalRecords);
  const currentPageRecords = filteredRecords.slice(startIndex, endIndex);

  const handleClearFilters = () => {
    setSearch('');
    setLimbTypeFilter('All');
    setDurationFilter('All');
    setCategoryFilter('All');
    setPage(1);
  };

  const startEditing = (record: PricingRate) => {
    setEditingId(record.id);
    setDraftRate(String(record.rate));
    setRateError('');
    setSuccessMessage('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftRate('');
    setRateError('');
  };

  const handleSave = async (record: PricingRate) => {
    const normalizedRate = draftRate.trim();

    if (!normalizedRate) {
      setRateError('Rate is required.');
      return;
    }

    const numericRate = Number(normalizedRate);

    if (Number.isNaN(numericRate)) {
      setRateError('Rate must be numeric.');
      return;
    }

    if (numericRate < 0) {
      setRateError('Rate must be greater than or equal to 0.');
      return;
    }

    setSavingId(record.id);
    setRateError('');
    setSuccessMessage('');

    try {
      const updatedRecord = await updatePricingRate(record.id, numericRate);

      setRecords((previousRecords) =>
        previousRecords.map((item) =>
          item.id === record.id
            ? {
                ...item,
                rate: String(updatedRecord.rate),
              }
            : item,
        ),
      );

      setEditingId(null);
      setDraftRate('');
      setSuccessMessage('Pricing updated successfully.');
    } catch {
      setRateError('Unable to update rate. Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <AppHeader role="Admin" />
      <div className="legacy-admin-page app-page"
      style={{
        minHeight: '100vh',
        background: '#f7f9fc',
        padding: '32px 24px',
        fontFamily: 'Segoe UI, Arial, sans-serif',
        color: '#0f172a',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 18,
            padding: 28,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#475569',
                  fontWeight: 700,
                }}
              >
                Admin Portal
              </p>
              <h1 style={{ margin: '10px 0 0', fontSize: '2rem' }}>Pricing Management</h1>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => window.location.assign('/admin/audit-logs')}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#1d4ed8',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                View Audit History
              </button>

              <button
                type="button"
                onClick={() => window.location.assign('/admin')}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
              <span>Search</span>
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Volume range or limb type"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#0f172a',
                  fontSize: 14,
                }}
              />
            </label>

            <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
              <span>Limb Type</span>
              <select
                value={limbTypeFilter}
                onChange={(event) => {
                  setLimbTypeFilter(event.target.value as 'All' | 'UNILATERAL' | 'BILATERAL');
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#0f172a',
                  fontSize: 14,
                }}
              >
                {limbTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'All' ? 'All' : option}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
              <span>Duration</span>
              <select
                value={durationFilter}
                onChange={(event) => {
                  setDurationFilter(event.target.value as 'All' | '7' | '10' | '14' | '21');
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#0f172a',
                  fontSize: 14,
                }}
              >
                {durationOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'All' ? 'All' : `${option} days`}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
              <span>Financial Category</span>
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value as 'All' | '1' | '2' | '3' | '4');
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#0f172a',
                  fontSize: 14,
                }}
              >
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'All' ? 'All' : option}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                type="button"
                onClick={handleClearFilters}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  color: '#334155',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {successMessage && (
            <div
              style={{
                marginBottom: 16,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 600,
              }}
            >
              {successMessage}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 16,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                borderRadius: 10,
                padding: '10px 12px',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
              Loading pricing records...
            </div>
          ) : currentPageRecords.length === 0 ? (
            <div
              style={{
                border: '1px dashed #cbd5e1',
                borderRadius: 12,
                padding: '32px 16px',
                textAlign: 'center',
                color: '#475569',
                background: '#f8fafc',
              }}
            >
              No pricing records match the selected filters.
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12, color: '#475569', fontWeight: 600 }}>
                Showing {totalRecords === 0 ? 0 : startIndex + 1}–{endIndex} of {totalRecords} records
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Limb Type</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Volume Range</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Duration</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Financial Category</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Rate</th>
                      <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageRecords.map((record) => {
                      const isEditing = editingId === record.id;

                      return (
                        <tr key={record.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 10px', color: '#0f172a' }}>{record.limb_type}</td>
                          <td style={{ padding: '12px 10px', color: '#334155' }}>{record.volume_range}</td>
                          <td style={{ padding: '12px 10px', color: '#334155' }}>{getDurationLabel(record.duration_days)}</td>
                          <td style={{ padding: '12px 10px', color: '#334155' }}>{record.financial_category}</td>
                          <td style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 700 }}>
                            {isEditing ? (
                              <div style={{ display: 'grid', gap: 6 }}>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={draftRate}
                                  onChange={(event) => setDraftRate(event.target.value)}
                                  style={{
                                    width: 140,
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    border: rateError ? '1px solid #dc2626' : '1px solid #cbd5e1',
                                    background: '#fff',
                                    color: '#0f172a',
                                  }}
                                />
                                {rateError && (
                                  <small style={{ color: '#b91c1c', fontWeight: 600 }}>{rateError}</small>
                                )}
                              </div>
                            ) : (
                              formatCurrency(record.rate)
                            )}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => void handleSave(record)}
                                  disabled={savingId === record.id}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#0f766e',
                                    color: '#fff',
                                    fontWeight: 700,
                                    cursor: savingId === record.id ? 'not-allowed' : 'pointer',
                                    opacity: savingId === record.id ? 0.7 : 1,
                                  }}
                                >
                                  {savingId === record.id ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditing}
                                  disabled={savingId === record.id}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    color: '#334155',
                                    fontWeight: 600,
                                    cursor: savingId === record.id ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEditing(record)}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1px solid #cbd5e1',
                                  background: '#fff',
                                  color: '#334155',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                Edit
                              </button>
                            )}
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
                  onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                  disabled={safeCurrentPage === 1}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    fontWeight: 600,
                    cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: safeCurrentPage === 1 ? 0.6 : 1,
                  }}
                >
                  Previous
                </button>

                <span style={{ color: '#475569', fontWeight: 600 }}>
                  Page {safeCurrentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    fontWeight: 600,
                    cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: safeCurrentPage >= totalPages ? 0.6 : 1,
                  }}
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

export default PricingManagement;
