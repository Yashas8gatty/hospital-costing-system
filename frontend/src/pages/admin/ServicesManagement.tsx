import { useEffect, useMemo, useState } from 'react';

import { createService, getAdminServices, updateService } from '../../services/adminServiceService';
import type { AdditionalService } from '../../types/pricing';

const formatCurrency = (value: number | string): string => {
  const numericValue = Number(value);

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
};

const EMPTY_FORM = {
  service_name: '',
  cost_per_day: '',
};

function ServicesManagement() {
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<{ service_name: string; cost_per_day: string; active: boolean }>({
    service_name: '',
    cost_per_day: '',
    active: true,
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingError, setEditingError] = useState('');
  const [pendingDeactivate, setPendingDeactivate] = useState<AdditionalService | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getAdminServices();
        setServices(data);
      } catch {
        setError('Unable to load additional services. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void fetchServices();
  }, []);

  const filteredServices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        normalizedSearch.length === 0 || service.service_name.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && service.active) ||
        (statusFilter === 'Inactive' && !service.active);

      return matchesSearch && matchesStatus;
    });
  }, [search, services, statusFilter]);

  const handleCreateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (formError) {
      setFormError('');
    }
  };

  const handleCreateSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const serviceName = formData.service_name.trim();
    const costValue = formData.cost_per_day.trim();

    if (!serviceName) {
      setFormError('Service name is required.');
      return;
    }

    if (!costValue) {
      setFormError('Cost per day is required.');
      return;
    }

    const numericCost = Number(costValue);

    if (Number.isNaN(numericCost)) {
      setFormError('Cost per day must be numeric.');
      return;
    }

    if (numericCost < 0) {
      setFormError('Cost per day must be greater than or equal to 0.');
      return;
    }

    setCreating(true);
    setFormError('');
    setSuccessMessage('');

    try {
      const createdService = await createService(serviceName, numericCost);
      setServices((previous) => [createdService, ...previous]);
      setFormData(EMPTY_FORM);
      setShowForm(false);
      setSuccessMessage('Service created successfully.');
    } catch (createError) {
      const errorMessage =
        createError instanceof Error && createError.message.includes('409')
          ? 'A service with this name already exists.'
          : 'Unable to create the service. Please try again.';

      setFormError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (service: AdditionalService) => {
    setEditingId(service.id);
    setEditingData({
      service_name: service.service_name,
      cost_per_day: String(service.cost_per_day),
      active: service.active,
    });
    setEditingError('');
    setSuccessMessage('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingData({
      service_name: '',
      cost_per_day: '',
      active: true,
    });
    setEditingError('');
  };

  const handleEditChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;

    setEditingData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (editingError) {
      setEditingError('');
    }
  };

  const handleSaveEdit = async (service: AdditionalService) => {
    const serviceName = editingData.service_name.trim();
    const costValue = editingData.cost_per_day.trim();

    if (!serviceName) {
      setEditingError('Service name is required.');
      return;
    }

    if (!costValue) {
      setEditingError('Cost per day is required.');
      return;
    }

    const numericCost = Number(costValue);

    if (Number.isNaN(numericCost)) {
      setEditingError('Cost per day must be numeric.');
      return;
    }

    if (numericCost < 0) {
      setEditingError('Cost per day must be greater than or equal to 0.');
      return;
    }

    setSavingId(service.id);
    setEditingError('');
    setSuccessMessage('');

    try {
      const updatedService = await updateService(service.id, {
        service_name: serviceName,
        cost_per_day: numericCost,
        active: editingData.active,
      });

      setServices((previous) =>
        previous.map((item) => (item.id === service.id ? updatedService : item)),
      );

      setEditingId(null);
      setEditingData({
        service_name: '',
        cost_per_day: '',
        active: true,
      });
      setSuccessMessage('Service updated successfully.');
    } catch (updateError) {
      const message =
        updateError instanceof Error && updateError.message.includes('409')
          ? 'A service with this name already exists.'
          : 'Unable to update the service. Please try again.';

      setEditingError(message);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeactivateClick = (service: AdditionalService) => {
    setPendingDeactivate(service);
  };

  const confirmDeactivate = async () => {
    if (!pendingDeactivate) {
      return;
    }

    setSavingId(pendingDeactivate.id);
    setSuccessMessage('');
    setError('');

    try {
      const updatedService = await updateService(pendingDeactivate.id, {
        active: false,
      });

      setServices((previous) =>
        previous.map((item) => (item.id === pendingDeactivate.id ? updatedService : item)),
      );

      setSuccessMessage(`${pendingDeactivate.service_name} has been deactivated.`);
    } catch {
      setError('Unable to deactivate the service. Please try again.');
    } finally {
      setPendingDeactivate(null);
      setSavingId(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f7f9fc',
        padding: '32px 24px',
        fontFamily: 'Segoe UI, Arial, sans-serif',
        color: '#0f172a',
      }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
              <h1 style={{ margin: '10px 0 0', fontSize: '2rem' }}>Additional Services</h1>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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

              <button
                type="button"
                onClick={() => setShowForm(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#0f766e',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Add Service
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            <label style={{ display: 'grid', gap: 8, fontWeight: 600 }}>
              <span>Search</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by service name"
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
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'All' | 'Active' | 'Inactive')}
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
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                type="button"
                onClick={clearFilters}
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

          {showForm && (
            <div
              style={{
                marginBottom: 20,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: 18,
              }}
            >
              <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>Add Service</h3>

              <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <label style={{ fontWeight: 600 }}>Service Name</label>
                  <input
                    type="text"
                    name="service_name"
                    value={formData.service_name}
                    onChange={handleCreateChange}
                    placeholder="Enter service name"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: formError ? '1px solid #dc2626' : '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#0f172a',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  <label style={{ fontWeight: 600 }}>Cost Per Day</label>
                  <input
                    type="number"
                    name="cost_per_day"
                    min="0"
                    step="0.01"
                    value={formData.cost_per_day}
                    onChange={handleCreateChange}
                    placeholder="Enter cost"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: formError ? '1px solid #dc2626' : '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#0f172a',
                    }}
                  />
                </div>

                {formError && (
                  <div style={{ color: '#b91c1c', fontWeight: 600 }}>{formError}</div>
                )}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="submit"
                    disabled={creating}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: '#0f766e',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: creating ? 'not-allowed' : 'pointer',
                      opacity: creating ? 0.7 : 1,
                    }}
                  >
                    {creating ? 'Creating...' : 'Create Service'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setFormError('');
                      setFormData(EMPTY_FORM);
                    }}
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
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {pendingDeactivate && (
            <div
              style={{
                marginBottom: 20,
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 12,
                padding: 18,
              }}
            >
              <p style={{ margin: '0 0 16px', color: '#9a4d00', fontWeight: 700 }}>
                Are you sure you want to deactivate {pendingDeactivate.service_name}?
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={confirmDeactivate}
                  disabled={savingId === pendingDeactivate.id}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#ea580c',
                    color: '#fff',
                    fontWeight: 700,
                    cursor: savingId === pendingDeactivate.id ? 'not-allowed' : 'pointer',
                    opacity: savingId === pendingDeactivate.id ? 0.7 : 1,
                  }}
                >
                  {savingId === pendingDeactivate.id ? 'Deactivating...' : 'Confirm Deactivate'}
                </button>

                <button
                  type="button"
                  onClick={() => setPendingDeactivate(null)}
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
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
              Loading services...
            </div>
          ) : filteredServices.length === 0 ? (
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
              No services match the current filters.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Service Name</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Cost / Day</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((service) => {
                    const isEditing = editingId === service.id;

                    return (
                      <tr key={service.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px 10px', color: '#0f172a' }}>
                          {isEditing ? (
                            <input
                              type="text"
                              name="service_name"
                              value={editingData.service_name}
                              onChange={handleEditChange}
                              style={{
                                width: '100%',
                                minWidth: 180,
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: editingError ? '1px solid #dc2626' : '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#0f172a',
                              }}
                            />
                          ) : (
                            service.service_name
                          )}
                        </td>

                        <td style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 700 }}>
                          {isEditing ? (
                            <input
                              type="number"
                              name="cost_per_day"
                              min="0"
                              step="0.01"
                              value={editingData.cost_per_day}
                              onChange={handleEditChange}
                              style={{
                                width: 144,
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: editingError ? '1px solid #dc2626' : '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#0f172a',
                              }}
                            />
                          ) : (
                            `${formatCurrency(service.cost_per_day)}/day`
                          )}
                        </td>

                        <td style={{ padding: '12px 10px' }}>
                          {isEditing ? (
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                              <input
                                type="checkbox"
                                name="active"
                                checked={editingData.active}
                                onChange={handleEditChange}
                              />
                              Active
                            </label>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '6px 10px',
                                borderRadius: 999,
                                background: service.active ? '#ecfdf5' : '#fef2f2',
                                color: service.active ? '#065f46' : '#b91c1c',
                                fontWeight: 700,
                              }}
                            >
                              {service.active ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '12px 10px' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => void handleSaveEdit(service)}
                                disabled={savingId === service.id}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: '#0f766e',
                                  color: '#fff',
                                  fontWeight: 700,
                                  cursor: savingId === service.id ? 'not-allowed' : 'pointer',
                                  opacity: savingId === service.id ? 0.7 : 1,
                                }}
                              >
                                {savingId === service.id ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={savingId === service.id}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1px solid #cbd5e1',
                                  background: '#fff',
                                  color: '#334155',
                                  fontWeight: 600,
                                  cursor: savingId === service.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => startEditing(service)}
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

                              {service.active && (
                                <button
                                  type="button"
                                  onClick={() => handleDeactivateClick(service)}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 8,
                                    border: '1px solid #fdba74',
                                    background: '#fff7ed',
                                    color: '#9a4d00',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServicesManagement;
