import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  finalizeCalculation,
  getCalculationPdf,
  getCalculation,
  uploadResultImage,
  removeResultImage,
  getResultImageBlob,
  type CalculationReport,
} from '../../services/calculationService';
import { getStoredAdmin } from '../../services/authService';

export const LETTERHEAD_RESERVED_MM = 60;

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
  const user = getStoredAdmin();
  const isAdmin = user?.role === 'ADMIN';

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

  const [resultImageSrc, setResultImageSrc] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    const loadCalculation = async () => {
      try {
        setError(null);
        const data = await getCalculation(id);
        setCalculation(data);
        if (data.result_image_path) {
          try {
            const blob = await getResultImageBlob(id);
            setResultImageSrc(URL.createObjectURL(blob));
          } catch (imgError) {
            console.error('Failed to load image blob:', imgError);
          }
        }
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

  useEffect(() => {
    return () => {
      if (resultImageSrc) {
        URL.revokeObjectURL(resultImageSrc);
      }
    };
  }, [resultImageSrc]);

  const handleUploadImage = async (file: File) => {
    if (!id || !calculation) return;

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPG, PNG, and WEBP are accepted.');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('Image must be 10 MB or smaller.');
      return;
    }

    setUploadError('');
    setIsUploadingImage(true);

    try {
      const response = await uploadResultImage(id, file);
      setCalculation((current) => current ? {
        ...current,
        result_image_path: response.result_image_path,
        result_image_original_name: response.result_image_original_name,
        result_image_mime_type: response.result_image_mime_type,
        result_image_size: response.result_image_size,
      } : current);
      const blob = await getResultImageBlob(id);
      setResultImageSrc(URL.createObjectURL(blob));
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadError('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!id || !calculation) return;

    setIsUploadingImage(true);
    setUploadError('');

    try {
      await removeResultImage(id);
      setCalculation((current) => current ? {
        ...current,
        result_image_path: null,
        result_image_original_name: null,
        result_image_mime_type: null,
        result_image_size: null,
      } : current);
      if (resultImageSrc) {
        URL.revokeObjectURL(resultImageSrc);
        setResultImageSrc(null);
      }
    } catch (err) {
      console.error('Remove failed:', err);
      setUploadError('Failed to remove image. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const downloadPdfFile = async (calcDbId: string, calcDisplayId: string) => {
    setIsDownloading(true);
    setPdfError('');

    try {
      const pdf = await getCalculationPdf(calcDbId);
      const url = URL.createObjectURL(pdf);
      const link = document.createElement('a');
      link.href = url;
      link.download = `calculation-report-${calcDisplayId.padStart(6, '0')}.pdf`;
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
      setSuccessMessage('Report finalized & Downloaded successfully.');

      // Automatically trigger the PDF download on success
      await downloadPdfFile(id, calculation.id);
    } catch (finalizeRequestError) {
      console.error('Calculation finalization failed:', finalizeRequestError);
      setFinalizeError('Unable to finalize this report. Please try again.');
    } finally {
      setIsFinalizing(false);
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
            onClick={() => navigate(isAdmin ? '/admin/billing-history' : '/doctor')}
          >
            {isAdmin ? 'Back to Billing History' : 'Back to Calculator'}
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
        {calculation.status === 'DRAFT' && !isAdmin && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => { setFinalizeError(''); setShowFinalizeConfirmation(true); }}
          >
            Finalize Report
          </button>
        )}


        {calculation.status === 'DRAFT' && !isAdmin && (
          <button
            className="quiet-button"
            type="button"
            onClick={() => navigate(`/doctor?edit=${calculation.id}`)}
          >
            Edit Calculation
          </button>
        )}

        <button
          className="quiet-button"
          type="button"
          onClick={() => navigate(isAdmin ? '/admin/billing-history' : '/doctor')}
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
            <button className="quiet-button" type="button" onClick={() => setShowFinalizeConfirmation(false)} disabled={isFinalizing || isDownloading}>Cancel</button>
            <button className="primary-button" type="button" onClick={() => void handleFinalize()} disabled={isFinalizing || isDownloading}>
              {isFinalizing ? 'Finalizing...' : isDownloading ? 'Downloading PDF...' : 'Finalize & Download'}
            </button>
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
            <div className={`report-details-grid${calculation.patient_gender ? ' report-details-grid--three' : ''}`}>
              {/* Row 1 */}
              <div>
                <span>Patient Name</span>
                <strong>{calculation.patient_name}</strong>
              </div>
              <div>
                <span>Patient Age</span>
                <strong>{calculation.patient_age}</strong>
              </div>
              {calculation.patient_gender && (
                <div>
                  <span>Gender</span>
                  <strong>
                    {calculation.patient_gender === 'MALE'
                      ? 'Male'
                      : calculation.patient_gender === 'FEMALE'
                        ? 'Female'
                        : 'Other'}
                  </strong>
                </div>
              )}

              {/* Row 2 */}
              <div style={{ gridColumn: calculation.patient_gender ? 'span 3' : 'span 2' }}>
                <span>Doctor</span>
                <div>
                  <strong>{calculation.doctor.name}</strong>
                  {calculation.doctor.designation && (
                    <span style={{ fontSize: '0.85rem', color: '#667085', fontWeight: 'normal', marginLeft: '8px' }}>
                      ({calculation.doctor.designation})
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ================= TREATMENT & IMAGE LAYOUT ================= */}
          {(() => {
            const hasImageSection = !!(calculation.result_image_path || (calculation.status === 'DRAFT' && !isAdmin));
            return hasImageSection ? (
              <div className="report-treatment-image-row" style={{ marginTop: '28px' }}>
                {/* Left Column: Treatment Details */}
                <section className="report-section" style={{ marginTop: 0 }}>
                  <h2>Treatment Details</h2>
                  <div className="report-details-grid">
                    <div>
                      <span>Limb Type</span>
                      <strong>{formatLimbType(calculation.limb_type)}</strong>
                    </div>
                    <div>
                      <span>Billing Volume</span>
                      <strong>{calculation.volume} Litres</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <span>Duration</span>
                      <strong>{calculation.duration_days} days</strong>
                    </div>
                  </div>
                </section>

                {/* Right Column: Clinical Image (No header, start directly at top of column) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {resultImageSrc ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <img
                        src={resultImageSrc}
                        style={{ maxWidth: '100%', maxHeight: '140px', objectFit: 'contain', borderRadius: '4px', border: '1px solid #dfe5e7' }}
                        alt="Clinical Result"
                      />
                      <span style={{ fontSize: '0.75rem', color: '#667085', marginTop: '6px', textAlign: 'center', fontWeight: '500' }}>
                        Clinical Image
                      </span>
                      {calculation.status === 'DRAFT' && !isAdmin && (
                        <button
                          className="secondary-button no-print"
                          type="button"
                          onClick={() => void handleRemoveImage()}
                          disabled={isUploadingImage}
                          style={{ borderColor: '#d92d20', color: '#d92d20', fontSize: '0.85rem', padding: '4px 8px', marginTop: '12px' }}
                        >
                          Remove Image
                        </button>
                      )}
                    </div>
                  ) : (
                    calculation.status === 'DRAFT' && !isAdmin && (
                      <div className="no-print" style={{ width: '100%' }}>
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDraggingOver(true);
                          }}
                          onDragLeave={() => setIsDraggingOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingOver(false);
                            const file = e.dataTransfer.files?.[0];
                            if (file) {
                              void handleUploadImage(file);
                            }
                          }}
                          style={{
                            border: isDraggingOver ? '2px dashed #009ba6' : '2px dashed #e5e7eb',
                            borderRadius: '8px',
                            padding: '16px',
                            textAlign: 'center',
                            backgroundColor: isDraggingOver ? '#f0fbfc' : '#fcfcfd',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            document.getElementById('file-upload-input')?.click();
                          }}
                        >
                          <input
                            id="file-upload-input"
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                void handleUploadImage(file);
                              }
                            }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#344054', fontWeight: '500' }}>
                              {isUploadingImage ? 'Uploading...' : 'Drag image here'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#667085' }}>or</span>
                            <button
                              className="secondary-button"
                              type="button"
                              disabled={isUploadingImage}
                              onClick={(e) => {
                                e.stopPropagation();
                                document.getElementById('file-upload-input')?.click();
                              }}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              Choose
                            </button>
                          </div>
                        </div>
                        {uploadError && (
                          <div style={{ marginTop: '6px', color: '#d92d20', fontSize: '0.75rem', fontWeight: '500' }}>
                            {uploadError}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : (
              /* Layout without image */
              <section className="report-section" style={{ marginTop: '28px' }}>
                <h2>Treatment Details</h2>
                <div className="report-details-grid">
                  <div>
                    <span>Limb Type</span>
                    <strong>{formatLimbType(calculation.limb_type)}</strong>
                  </div>
                  <div>
                    <span>Billing Volume</span>
                    <strong>{calculation.volume} Litres</strong>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span>Duration</span>
                    <strong>{calculation.duration_days} days</strong>
                  </div>
                </div>
              </section>
            );
          })()}

          {/* ================= COST BREAKDOWN ================= */}
          <section className="report-section report-cost-section" style={{ marginTop: '16px' }}>
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
              <span style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#667085' }}>
                Note: This cost estimate is valid for 90 days from the date of billing.
              </span>
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