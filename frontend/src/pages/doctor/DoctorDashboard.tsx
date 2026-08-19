import { useMemo, useState } from 'react';
import { api } from '../../services/api';
import type {
  AdditionalService,
  FinancialCategory,
  LimbType,
  PricingRate,
  PricingResponse,
  ServicesResponse,
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
  Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function DoctorDashboard() {
  const [formData, setFormData] = useState<FormState>(initialForm);
  const [pricing, setPricing] = useState<PricingRate | null>(null);
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [selectedServices, setSelectedServices] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;

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

    const volume = Number(formData.volume);

    if (!formData.limbType || !formData.volume || !formData.duration || !formData.financialCategory) {
      setError('Please complete all required fields before calculating the cost.');
      return;
    }

    if (Number.isNaN(volume) || volume <= 0) {
      setError('Volume must be a valid number greater than 0.');
      return;
    }

    setLoading(true);

    try {
      const pricingResponse = await api.get<PricingResponse>('/pricing', {
        params: {
          limbType: formData.limbType,
          volume: formData.volume,
          duration: formData.duration,
          financialCategory: formData.financialCategory,
        },
      });

      if (!pricingResponse.data?.data) {
        setError('No pricing rate found for the selected criteria.');
        setPricing(null);
        setServices([]);
        setSelectedServices({});
        return;
      }

      const nextPricing = pricingResponse.data.data;
      setPricing(nextPricing);

      setServicesLoading(true);
      try {
        const servicesResponse = await api.get<ServicesResponse>('/services');
        setServices(servicesResponse.data.data || []);
        setSelectedServices({});
      } catch (serviceError) {
        console.error('Error loading services:', serviceError);
        setError('Unable to load additional services right now.');
        setServices([]);
        setSelectedServices({});
      } finally {
        setServicesLoading(false);
      }
    } catch (pricingError: any) {
      console.error('Pricing lookup failed:', pricingError);

      if (pricingError?.response?.status === 404) {
        setError('No pricing rate found for the given criteria.');
      } else if (pricingError?.response?.status === 400) {
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
    <div style={{ maxWidth: 900, margin: '40px auto', padding: 24, fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: 24 }}>Doctor Costing Dashboard</h1>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span><strong>Limb Type</strong></span>
            <select
              name="limbType"
              value={formData.limbType}
              onChange={handleInputChange}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc' }}
            >
              <option value="UNILATERAL">Unilateral</option>
              <option value="BILATERAL">Bilateral</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span><strong>Limb Volume (L)</strong></span>
            <input
              name="volume"
              type="number"
              min="0"
              step="0.1"
              value={formData.volume}
              onChange={handleInputChange}
              placeholder="Enter volume"
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span><strong>Treatment Duration</strong></span>
            <select
              name="duration"
              value={String(formData.duration)}
              onChange={handleInputChange}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc' }}
            >
              <option value="7">7 days</option>
              <option value="10">10 days</option>
              <option value="14">14 days</option>
              <option value="21">21 days</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span><strong>Financial Category</strong></span>
            <select
              name="financialCategory"
              value={String(formData.financialCategory)}
              onChange={handleInputChange}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #ccc' }}
            >
              <option value="1">Category 1</option>
              <option value="2">Category 2</option>
              <option value="3">Category 3</option>
              <option value="4">Category 4</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#0b5ed7',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            maxWidth: 220,
          }}
        >
          {loading ? 'Calculating...' : 'Calculate Cost'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 20, color: '#b42318', background: '#fef3f2', padding: '12px 14px', borderRadius: 8 }}>
          {error}
        </div>
      )}

      {pricing && (
        <div style={{ marginTop: 32, border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, background: '#f8fafc' }}>
          <h2 style={{ marginTop: 0, marginBottom: 16 }}>Cost Summary</h2>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Base Treatment</span>
              <strong>{formatCurrency(baseTreatment)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Additional Services</span>
              <strong>{formatCurrency(additionalServicesTotal)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #dbe4f0', paddingTop: 12 }}>
              <span><strong>Total Estimated Cost</strong></span>
              <strong>{formatCurrency(totalEstimatedCost)}</strong>
            </div>
          </div>
        </div>
      )}

      {servicesLoading && (
        <div style={{ marginTop: 20, color: '#1d4ed8' }}>Loading services...</div>
      )}

      {!servicesLoading && services.length > 0 && (
        <div style={{ marginTop: 24, border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
          <h3 style={{ marginTop: 0 }}>Additional Services</h3>

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
                    border: '1px solid #dfe7f1',
                    borderRadius: 8,
                    background: isSelected ? '#eef6ff' : '#fff',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleServiceToggle(Number(service.id))}
                    />
                    <span>
                      <div>{service.service_name}</div>
                      <small>{formatCurrency(service.cost_per_day)} per day</small>
                    </span>
                  </span>

                  <strong>{formatCurrency(serviceCost)}</strong>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
