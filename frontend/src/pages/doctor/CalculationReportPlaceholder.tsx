import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  finalizeCalculation,
  getCalculationPdf,
  getCalculation,
  type CalculationReport,
} from '../../services/calculationService';

export const LETTERHEAD_RESERVED_MM = 50;

const formatCurrency = (value: string | number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));

const formatLimbType = (
  value: CalculationReport['limb_type'],
): string => (value === 'UNILATERAL' ? 'Unilateral' : 'Bilateral');

export default function CalculationReportPlaceholder() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [calculation, setCalculation] =
    useState<CalculationReport | null>(null);

  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<'not-found' | 'load' | null>(
    id ? null : 'not-found',
  );
  const [showFinalizeConfirmation, setShowFinalizeConfirmation] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    if (!id) {
      return;
    }

    const loadCalculation = async () => {
      try {
        setError(null);
        setCalculation(await getCalculation(id));
      } catch (requestError) {
        const axiosError = requestError as {
          response?: {
            status?: number;
          };
        };

        setError(
          axiosError.response?.status === 404
            ? 'not-found'
            : 'load',
        );
      } finally {
        setLoading(false);
      }
    };

    void loadCalculation();
  }, [id]);

  const handleFinalize = async () => {
    if (!calculation || !id || isFinalizing) {
      return;
    }

    setIsFinalizing(true);
    setFinalizeError('');
    setSuccessMessage('');

    try {
      const finalized = await finalizeCalculation(id);
      setCalculation((current) => current ? {
        ...current,
        status: 'FINAL',
        updated_at: finalized.updated_at ?? current.updated_at,
      } : current);
      setShowFinalizeConfirmation(false);
      setSuccessMessage('Report finalized successfully.');
    } catch (finalizeRequestError) {
      console.error('Calculation finalization failed:', finalizeRequestError);
      setFinalizeError('Unable to finalize this report. Please try again.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!calculation || !id || calculation.status !== 'FINAL' || isDownloading) {
      return;
    }

    setIsDownloading(true);
    setPdfError('');

    try {
      const pdf = await getCalculationPdf(id);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = `calculation-report-${calculation.id.padStart(6, '0')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      console.error('Calculation PDF download failed:', downloadError);
      setPdfError('Unable to download the PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <main className="report-shell">
        <div className="report-state">
          Loading report...
        </div>
      </main>
    );
  }

  if (error || !calculation) {
    return (
      <main className="report-shell">
        <div className="report-state">
          <p className="eyebrow">Calculation report</p>

          <h1 className="page-title">
            {error === 'not-found'
              ? 'Calculation not found.'
              : 'Unable to load this calculation.'}
          </h1>

          <button
            className="primary-button"
            type="button"
            onClick={() => navigate('/doctor')}
          >
            Back to Calculator
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="report-shell">
      {/* Actions stay outside the printable A4 report */}
      <div
        className="report-actions"
        aria-label="Report actions"
      >
        {calculation.status === 'DRAFT' && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => { setFinalizeError(''); setShowFinalizeConfirmation(true); }}
          >
            Finalize Report
          </button>
        )}

        {calculation.status === 'FINAL' && (
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleDownloadPdf()}
            disabled={isDownloading}
          >
            {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
          </button>
        )}

        {calculation.status === 'DRAFT' && (
          <button
            className="quiet-button"
            type="button"
            onClick={() => navigate('/doctor')}
          >
            Edit Calculation
          </button>
        )}

        <button
          className="quiet-button"
          type="button"
          onClick={() => navigate('/doctor')}
        >
          Back
        </button>
      </div>

      {successMessage && <div className="notice">{successMessage}</div>}
      {finalizeError && <div className="alert">{finalizeError}</div>}
      {pdfError && <div className="alert">{pdfError}</div>}
      {showFinalizeConfirmation && calculation.status === 'DRAFT' && (
        <div className="notice" role="dialog" aria-label="Confirm report finalization">
          <strong>Finalize this report?</strong>
          <p>Once finalized, this report cannot be edited through the normal calculator flow.</p>
          <div className="actions">
            <button className="quiet-button" type="button" onClick={() => setShowFinalizeConfirmation(false)} disabled={isFinalizing}>Cancel</button>
            <button className="primary-button" type="button" onClick={() => void handleFinalize()} disabled={isFinalizing}>{isFinalizing ? 'Finalizing...' : 'Confirm & Finalize'}</button>
          </div>
        </div>
      )}

      <article className="report-page">
        {/* 50mm reserved for physical letterhead */}
        <div
          className="report-letterhead-space"
          style={{
            height: `${LETTERHEAD_RESERVED_MM}mm`,
          }}
          aria-hidden="true"
        />

        <div className="report-content">
          {/* ================= PATIENT DETAILS ================= */}
          <section className="report-section">
            <div className="report-section-heading">
              <h2>Patient Details</h2>
              <time dateTime={calculation.created_at}>
                {formatDateTime(calculation.created_at)}
              </time>
            </div>

            <div className="report-details-grid">
              <div>
                <span>Patient Name</span>
                <strong>{calculation.patient_name}</strong>
              </div>

              <div>
                <span>Patient Age</span>
                <strong>{calculation.patient_age}</strong>
              </div>

              <div>
                <span>Doctor</span>
                <strong>{calculation.doctor.name}</strong>
              </div>

              <div>
                <span>Designation</span>
                <strong>
                  {calculation.doctor.designation}
                </strong>
              </div>
            </div>
          </section>

          {/* ================= TREATMENT DETAILS ================= */}
          <section className="report-section">
            <h2>Treatment Details</h2>

            <div className="report-details-grid report-details-grid--four">
              <div>
                <span>Limb Type</span>
                <strong>
                  {formatLimbType(calculation.limb_type)}
                </strong>
              </div>

              <div>
                <span>Billing Volume</span>
                <strong>
                  {calculation.volume} Litres
                </strong>
              </div>

              <div>
                <span>Duration</span>
                <strong>
                  {calculation.duration_days} days
                </strong>
              </div>

              <div>
                <span>Financial Category</span>
                <strong>
                  {calculation.financial_category}
                </strong>
              </div>
            </div>
          </section>

          {/* ================= COST BREAKDOWN ================= */}
          <section className="report-section report-cost-section">
            <h2>Cost Breakdown</h2>

            {/* Base treatment */}
            <div className="report-cost-line report-base-line">
              <span>Base Treatment</span>

              <strong>
                {formatCurrency(calculation.base_rate)}
              </strong>
            </div>

            {/* Additional services */}
            <div className="report-services-block">
              <div className="report-services-label">
                Additional Services
              </div>

              {calculation.services.length === 0 ? (
                <p className="report-no-services">
                  None
                </p>
              ) : (
                <div className="report-service-table">
                  <div
                    className="report-service-table__header"
                    aria-hidden="true"
                  >
                    <span>Service</span>
                    <span>Rate &amp; Duration</span>
                    <span>Amount</span>
                  </div>

                  {calculation.services.map((service) => (
                    <div
                      className="report-service-row"
                      key={service.service_id}
                    >
                      <strong>
                        {service.service_name}
                      </strong>

                      <span>
                        {formatCurrency(
                          service.cost_per_day,
                        )}
                        /day × {service.duration_days} days
                      </span>

                      <strong>
                        {formatCurrency(
                          service.total_cost,
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Final total only. No additional-service subtotal. */}
            <div className="report-total">
              <span>Total Treatment Cost</span>

              <strong>
                {formatCurrency(calculation.total_cost)}
              </strong>
            </div>
          </section>

          <footer className="report-footer">
  <div className="report-footer-meta">
    <div>
      <span>Report ID: </span>
      <strong>#{calculation.id.padStart(6, '0')}</strong>
    </div>

  </div>

  <div className="signature-block">
    <div className="signature-line" />

    <span>Signature</span>

    <strong>{calculation.signatory.name}</strong>

    <span>{calculation.signatory.designation}</span>
  </div>
</footer> 
        </div>
      </article>
    </main>
  );
}