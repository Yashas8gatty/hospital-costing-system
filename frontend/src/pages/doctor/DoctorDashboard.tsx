import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import AppHeader from '../../components/layout/AppHeader';
import { clearSelectedDoctor, getSelectedDoctor } from '../../services/doctorService';
import { createCalculation } from '../../services/calculationService';

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
  const navigate = useNavigate();
  const selectedDoctor = getSelectedDoctor();
  const [formData, setFormData] = useState<FormState>(initialForm);
  const [pricing, setPricing] = useState<PricingRate | null>(null);
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [selectedServices, setSelectedServices] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [error, setError] = useState('');
  const [volumeError, setVolumeError] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientError, setPatientError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleDoctorLogout = () => {
    clearSelectedDoctor();
    navigate('/doctor/login', { replace: true });
  };

  useEffect(() => {
    const doctor = getSelectedDoctor();

    if (!doctor) {
      navigate('/doctor/login', { replace: true });
      return;
    }

  }, [navigate]);

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
    setPatientName('');
    setPatientAge('');
    setPatientError('');
    setSaveError('');
    setPricing(null);
    setServices([]);
    setSelectedServices({});
    setError('');
    setVolumeError('');
    setLoading(false);
    setServicesLoading(false);
  };

  const handleSaveCalculation = async () => {
    const trimmedPatientName = patientName.trim();
    const parsedPatientAge = Number(patientAge.trim());

    if (!trimmedPatientName) {
      setPatientError('Patient name is required.');
      return;
    }

    if (!patientAge.trim() || !Number.isInteger(parsedPatientAge) || parsedPatientAge < 0 || parsedPatientAge > 150) {
      setPatientError('Patient age must be a whole number between 0 and 150.');
      return;
    }

    if (!selectedDoctor || !pricing) {
      setSaveError('Calculate a cost before saving.');
      return;
    }

    const selectedServiceSnapshots = services
      .filter((service) => selectedServices[Number(service.id)])
      .map((service) => ({
        service_id: Number(service.id),
        service_name: service.service_name,
        cost_per_day: Number(service.cost_per_day),
        duration_days: Number(formData.duration),
        total_cost: Number(service.cost_per_day) * Number(formData.duration),
      }));

    setSaving(true);
    setPatientError('');
    setSaveError('');

    try {
      const calculation = await createCalculation({
        doctor_id: selectedDoctor.id,
        patient_name: trimmedPatientName,
        patient_age: parsedPatientAge,
        limb_type: formData.limbType,
        volume: Number(formData.volume),
        duration_days: formData.duration,
        financial_category: formData.financialCategory,
        base_rate: baseTreatment,
        services: selectedServiceSnapshots,
        additional_services_total: additionalServicesTotal,
        total_cost: totalEstimatedCost,
      });

      navigate(`/doctor/report/${calculation.id}`);
    } catch (error) {
      console.error('Calculation save failed:', error);
      setSaveError('Unable to save the calculation. Please try again.');
    } finally {
      setSaving(false);
    }
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
    <>
      <AppHeader role="Doctor" doctor={selectedDoctor} onLogout={handleDoctorLogout} />
      <main className="app-page">
        <div className="app-page__inner">
          <div className="page-intro">
            <p className="eyebrow">Treatment costing</p>
            <h1 className="page-title">Treatment Cost Calculator</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <section className="panel">
              <h2 className="section-label">Patient Details</h2>
              <div className="form-grid patient-details-grid">
                <label className="field">
                  <span>Patient Name</span>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(event) => { setPatientName(event.target.value); setPatientError(''); }}
                    placeholder="Enter patient name"
                  />
                </label>
                <label className="field">
                  <span>Patient Age</span>
                  <input
                    type="number"
                    min="0"
                    max="150"
                    step="1"
                    value={patientAge}
                    onChange={(event) => { setPatientAge(event.target.value); setPatientError(''); }}
                    placeholder="Enter age"
                  />
                </label>
              </div>
              {patientError && <small className="inline-error">{patientError}</small>}
            </section>
            <section className="panel">
              <h2 className="section-label">Treatment Details</h2>
              <div className="form-grid">
                <label className="field">
                  <span>Limb Type</span>
              <select
                name="limbType"
                value={formData.limbType}
                onChange={handleInputChange}
                aria-label="Limb Type"
              >
                <option value="UNILATERAL">Unilateral</option>
                <option value="BILATERAL">Bilateral</option>
              </select>
                </label>

                <label className="field">
                  <span>Limb Volume <small>(Litres)</small></span>
                  <div className="volume-field">
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
                />
  
                  </div>
              {volumeError && (
                <small id="volume-error" className="inline-error">
                  {volumeError}
                </small>
              )}
                </label>

                <label className="field">
                  <span>Treatment Duration</span>
              <select
                name="duration"
                value={String(formData.duration)}
                onChange={handleInputChange}
                aria-label="Treatment Duration"
              >
                <option value="7">7 days</option>
                <option value="10">10 days</option>
                <option value="14">14 days</option>
                <option value="21">21 days</option>
              </select>
                </label>

                <label className="field">
                  <span>Financial Category</span>
              <select
                name="financialCategory"
                value={String(formData.financialCategory)}
                onChange={handleInputChange}
                aria-label="Financial Category"
              >
                <option value="1">Category 1</option>
                <option value="2">Category 2</option>
                <option value="3">Category 3</option>
                <option value="4">Category 4</option>
              </select>
                </label>
              </div>
            </section>

            <div className="actions calculator-actions">
          <button
            type="submit"
            disabled={loading}
            className="primary-button"
          >
            {loading ? 'Calculating...' : 'Calculate Cost'}
          </button>

          <button
            type="button"
            onClick={resetCalculator}
            className="secondary-button"
          >
            New Calculation
          </button>
            </div>
          </form>

      {error && (
        <div className="alert">
          {error}
        </div>
      )}

      {saveError && <div className="alert">{saveError}</div>}

      {pricing && (
        <section className="panel cost-summary">
          <h2 className="section-label">
            Cost Summary
          </h2>

          <div>
            <div className="cost-line">
              <span>Base Treatment</span>
              <strong>{formatCurrency(baseTreatment)}</strong>
            </div>
            <div className="cost-line">
              <span>Additional Services</span>
              <strong>{formatCurrency(additionalServicesTotal)}</strong>
            </div>
            <div className="cost-line">
              <span><strong>Total Estimated Cost</strong></span>
              <strong className="cost-total">{formatCurrency(totalEstimatedCost)}</strong>
            </div>
          </div>
          <div className="actions calculator-actions">
            <button className="primary-button" type="button" onClick={() => void handleSaveCalculation()} disabled={saving}>
              {saving ? 'Saving...' : 'Save Calculation'}
            </button>
          </div>
        </section>
      )}

      {servicesLoading && (
        <div className="notice">
          Loading services...
        </div>
      )}

      {!servicesLoading && services.length > 0 && (
        <section className="panel">
          <h2 className="section-label">
            Additional Services
          </h2>

          <div className="service-list">
            {services.map((service) => {
              const isSelected = !!selectedServices[Number(service.id)];
              const serviceCost = Number(service.cost_per_day) * Number(formData.duration);

              return (
                <label
                  key={service.id}
                  className={`service-row${isSelected ? ' is-selected' : ''}`}
                >
                  <span className="service-row__main">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleServiceToggle(Number(service.id))}
                      aria-label={service.service_name}
                    />
                    <span>
                      <div className="service-name">{service.service_name}</div>
                      <small className="service-cost">{formatCurrency(service.cost_per_day)} per day</small>
                    </span>
                  </span>

                  <strong>{formatCurrency(serviceCost)}</strong>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {!servicesLoading && services.length === 0 && pricing && (
        <div className="empty-state">
          No additional services are available at the moment.
        </div>
      )}
        </div>
      </main>
    </>
  );
}
