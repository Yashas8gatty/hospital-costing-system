import { useMemo, useState } from 'react';
import {
  getAdditionalServices,
  getPricing,
} from '../../services/pricingService';
import type {
  AdditionalService,
  FinancialCategory,
  LimbType,
  PricingRate,
  TreatmentDuration,
} from '../../types/pricing';

type FormState = {
  limbType: LimbType;
  volume: string;
  duration: TreatmentDuration;
  financialCategory: FinancialCategory;
};

const initialForm: FormState = {
  limbType: 'UNILATERAL',
  volume: '',
  duration: 7,
  financialCategory: 1,
};

const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value));

export default function DoctorDashboard() {
  const [formData, setFormData] = useState<FormState>(initialForm);
  const [pricing, setPricing] = useState<PricingRate | null>(null);
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [selectedServices, setSelectedServices] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [error, setError] = useState('');
  const [volumeError, setVolumeError] = useState('');

  const baseTreatment = pricing ? Number(pricing.rate) : 0;

  const additionalServicesTotal = useMemo(() => {
    return services.reduce((total, service) => {
      const serviceId = Number(service.id);
      if (!selectedServices[serviceId]) {
        return total;
      }

      return total + Number(service.cost_per_day) * Number(formData.duration);
    }, 0);
  }, [formData.duration, selectedServices, services]);

  const totalEstimatedCost = baseTreatment + additionalServicesTotal;

  const resetCalculator = () => {
    setFormData(initialForm);
    setPricing(null);
    setServices([]);
    setSelectedServices({});
    setError('');
    setVolumeError('');
    setLoading(false);
    setServicesLoading(false);
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

    if (name === 'volume') {
      setVolumeError('');
    }

    setFormData((current) => ({
      ...current,
      [name]: name === 'duration' || name === 'financialCategory'
        ? Number(value)
        : name === 'limbType'
          ? value as LimbType
          : value,
    }));
  };

  const handleServiceToggle = (serviceId: number) => {
    setSelectedServices((current) => ({
      ...current,
      [serviceId]: !current[serviceId],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setVolumeError('');

    const volume = Number(formData.volume);

    if (!formData.limbType || !formData.volume || !formData.duration || !formData.financialCategory) {
      setError('Please complete all required fields before calculating the cost.');
      if (!formData.volume) {
        setVolumeError('Limb volume is required.');
      }
      return;
    }

    if (Number.isNaN(volume) || volume <= 0) {
      setVolumeError('Volume must be a valid number greater than 0.');
      setError('Volume must be a valid number greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const pricingResponse = await getPricing(
        formData.limbType,
        formData.volume,
        formData.duration,
        formData.financialCategory
      );

      if (!pricingResponse.data) {
        setError('No pricing rate found for the selected criteria.');
        setPricing(null);
        setServices([]);
        setSelectedServices({});
        return;
      }

      const nextPricing = pricingResponse.data;
      setPricing(nextPricing);

      setServicesLoading(true);
      try {
        const servicesResponse = await getAdditionalServices();
        setServices(servicesResponse.data || []);
        setSelectedServices({});
      } catch (serviceError) {
        console.error('Error loading services:', serviceError);
        setError('Unable to load additional services right now.');
        setServices([]);
        setSelectedServices({});
      } finally {
        setServicesLoading(false);
      }
    } catch (pricingError: unknown) {
      console.error('Pricing lookup failed:', pricingError);

      const axiosError = pricingError as {
        response?: { status?: number };
      };

      if (axiosError?.response?.status === 404) {
        setError('No pricing rate found for the given criteria.');
      } else if (axiosError?.response?.status === 400) {
        setError('Please check the selected values and try again.');
      } else {
        setError('The pricing service is unavailable. Please try again later.');
      }

      setPricing(null);
      setServices([]);
      setSelectedServices({});
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: 1100,
      margin: '32px auto',
      padding: '24px 20px 36px',
      fontFamily: 'Segoe UI, Arial, sans-serif',
      color: '#1f2937',
      background: '#f7f9fc',
    }}>
      <header style={{ marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid #dfe7f1' }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4b5563' }}>
          Hospital Pricing
        </p>
        <h1 style={{ margin: '8px 0 4px', fontSize: '2.1rem', color: '#0f172a' }}>Hospital Costing</h1>
        <p style={{ margin: 0, color: '#475569', fontSize: '1.05rem' }}>Treatment Cost Calculator</p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 24 }}>
        <section style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
          <h2 style={{ margin: '0 0 18px', fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151' }}>
            Patient / Treatment Details
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Limb Type</span>
              <select
                name="limbType"
                value={formData.limbType}
                onChange={handleInputChange}
                aria-label="Limb Type"
                style={{
                  padding: '11px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  fontSize: 15,
                }}
              >
                <option value="UNILATERAL">Unilateral</option>
                <option value="BILATERAL">Bilateral</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Limb Volume</span>
              <div style={{ position: 'relative' }}>
                <input
                  name="volume"
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.volume}
                  onChange={handleInputChange}
                  placeholder="Enter volume"
                  aria-invalid={Boolean(volumeError)}
                  aria-describedby={volumeError ? 'volume-error' : undefined}
                  style={{
                    width: '100%',
                    padding: '11px 90px 11px 12px',
                    borderRadius: 10,
                    border: volumeError ? '1px solid #dc2626' : '1px solid #cbd5e1',
                    background: '#fff',
                    fontSize: 15,
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: 600 }}>
                  Litres (L)
                </span>
              </div>
              {volumeError && (
                <small id="volume-error" style={{ color: '#b91c1c', fontWeight: 600 }}>
                  {volumeError}
                </small>
              )}
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Treatment Duration</span>
              <select
                name="duration"
                value={String(formData.duration)}
                onChange={handleInputChange}
                aria-label="Treatment Duration"
                style={{
                  padding: '11px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  fontSize: 15,
                }}
              >
                <option value="7">7 days</option>
                <option value="10">10 days</option>
                <option value="14">14 days</option>
                <option value="21">21 days</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>Financial Category</span>
              <select
                name="financialCategory"
                value={String(formData.financialCategory)}
                onChange={handleInputChange}
                aria-label="Financial Category"
                style={{
                  padding: '11px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#fff',
                  fontSize: 15,
                }}
              >
                <option value="1">Category 1</option>
                <option value="2">Category 2</option>
                <option value="3">Category 3</option>
                <option value="4">Category 4</option>
              </select>
            </label>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '13px 24px',
              borderRadius: 10,
              border: 'none',
              background: '#0f766e',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              minWidth: 180,
            }}
          >
            {loading ? 'Calculating...' : 'Calculate Cost'}
          </button>

          <button
            type="button"
            onClick={resetCalculator}
            style={{
              padding: '13px 18px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#334155',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            New Calculation
          </button>
        </div>
      </form>

      {error && (
        <div style={{ marginTop: 20, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 14px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {pricing && (
        <section style={{ marginTop: 26, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
          <h2 style={{ margin: '0 0 18px', fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151' }}>
            Cost Summary
          </h2>

          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #eef2f7' }}>
              <span style={{ color: '#475569' }}>Base Treatment</span>
              <strong style={{ fontSize: 17 }}>{formatCurrency(baseTreatment)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #eef2f7' }}>
              <span style={{ color: '#475569' }}>Additional Services</span>
              <strong style={{ fontSize: 17 }}>{formatCurrency(additionalServicesTotal)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
              <span style={{ color: '#111827', fontSize: 17, fontWeight: 700 }}>Total Estimated Cost</span>
              <strong style={{ fontSize: 22, color: '#0f172a' }}>{formatCurrency(totalEstimatedCost)}</strong>
            </div>
          </div>
        </section>
      )}

      {servicesLoading && (
        <div style={{ marginTop: 20, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px', fontWeight: 600 }}>
          Loading services...
        </div>
      )}

      {!servicesLoading && services.length > 0 && (
        <section style={{ marginTop: 26, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 20 }}>
          <h2 style={{ margin: '0 0 18px', fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#374151' }}>
            Additional Services
          </h2>

          <div style={{ display: 'grid', gap: 12 }}>
            {services.map((service) => {
              const isSelected = !!selectedServices[Number(service.id)];
              const serviceCost = Number(service.cost_per_day) * Number(formData.duration);

              return (
                <label
                  key={service.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    padding: '12px 14px',
                    border: isSelected ? '1px solid #94a3b8' : '1px solid #e2e8f0',
                    borderRadius: 10,
                    background: isSelected ? '#f8fafc' : '#fff',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleServiceToggle(Number(service.id))}
                      aria-label={service.service_name}
                    />
                    <span>
                      <div style={{ fontWeight: 600 }}>{service.service_name}</div>
                      <small style={{ color: '#475569' }}>{formatCurrency(service.cost_per_day)} per day</small>
                    </span>
                  </span>

                  <strong style={{ color: '#0f172a' }}>{formatCurrency(serviceCost)}</strong>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {!servicesLoading && services.length === 0 && pricing && (
        <div style={{ marginTop: 20, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '12px 14px', color: '#475569' }}>
          No additional services are available at the moment.
        </div>
      )}
    </div>
  );
}
