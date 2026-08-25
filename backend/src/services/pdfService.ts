import { chromium } from "playwright";

type CalculationServiceSnapshot = {
  service_id: number;
  service_name: string;
  cost_per_day: number;
  duration_days: number;
  total_cost: number;
};

type CalculationForPdf = {
  id: string;
  patient_name: string;
  patient_age: number;
  limb_type: "UNILATERAL" | "BILATERAL";
  volume: string;
  duration_days: number;
  financial_category: number;
  base_rate: string;
  services: CalculationServiceSnapshot[];
  total_cost: string;
  created_at: string;
  doctor: {
    name: string;
    designation: string;
  };
  signatory: {
    name: string;
    designation: string;
  };
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\"/g, "&quot;")
  .replace(/'/g, "&#039;");

const formatCurrency = (value: string | number): string => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value));

const formatDate = (value: string): string => new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "long",
  year: "numeric",
}).format(new Date(value));

const formatLimbType = (value: CalculationForPdf["limb_type"]): string =>
  value === "UNILATERAL" ? "Unilateral" : "Bilateral";

const renderServices = (calculation: CalculationForPdf): string => {
  if (calculation.services.length === 0) {
    return '<p class="report-no-services">None</p>';
  }

  const rows = calculation.services.map((service) => `
    <div class="report-service-row">
      <strong>${escapeHtml(service.service_name)}</strong>
      <span>${formatCurrency(service.cost_per_day)}/day x ${service.duration_days} days</span>
      <strong>${formatCurrency(service.total_cost)}</strong>
    </div>`).join("");

  return `<div class="report-service-table">
    <div class="report-service-table__header"><span>Service</span><span>Rate &amp; Duration</span><span>Amount</span></div>
    ${rows}
  </div>`;
};

const renderReportHtml = (calculation: CalculationForPdf): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { color: #1f2933; font-family: Arial, sans-serif; font-size: 10px; }
.report-page { width: 210mm; min-height: 297mm; background: #fff; }
.report-letterhead-space { height: 50mm; }
.report-content { display: flex; flex-direction: column; min-height: 247mm; padding: 0 18mm 16mm; }
.report-section { margin-top: 24px; }
.report-section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; margin-bottom: 12px; }
.report-section h2 { margin: 0; color: #007f87; font-family: Georgia, serif; font-size: 16px; }
.report-section-heading time { color: #667085; font-size: 13px; font-weight: 600; white-space: nowrap; }
.report-details-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; }
.report-details-grid > div { display: grid; gap: 5px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 11px 12px; }
.report-details-grid span, .report-service-row span { color: #667085; font-size: 11px; }
.report-details-grid strong { color: #1f2933; font-size: 12px; }
.report-details-grid--four > div { width: 25%; }
.report-details-grid--four { display: flex; }
.report-cost-line, .report-total { display: flex; align-items: baseline; justify-content: space-between; gap: 18px; border-bottom: 1px solid #e5e7eb; padding: 11px 0; }
.report-cost-line strong { font-weight: 700; }
.report-base-line { font-size: 15px; }
.report-base-line strong { font-size: 16px; }
.report-services-block { border-bottom: 1px solid #e5e7eb; padding-top: 14px; }
.report-service-table { width: 100%; margin-top: 12px; }
.report-service-table__header, .report-service-row { display: grid; grid-template-columns: 1.5fr 1.5fr 0.8fr; align-items: center; column-gap: 20px; }
.report-service-table__header { padding: 0 0 8px; border-bottom: 1px solid #dfe5e7; color: #667085; font-size: 11px; font-weight: 600; }
.report-service-table__header span:last-child, .report-service-row > strong:last-child { text-align: right; }
.report-service-row { padding: 11px 0; border-bottom: 1px solid #edf0f1; }
.report-service-row:last-child { border-bottom: 0; }
.report-service-row > span { color: #667085; font-size: 11px; }
.report-service-row > strong:first-child { color: #1f2933; font-size: 12px; }
.report-service-row > strong:last-child { color: #1f2933; font-size: 12px; }
.report-services-label { margin-top: 18px; color: #007f87; font-family: Georgia, serif; font-size: 16px; font-weight: 700; }
.report-no-services { margin: 10px 0 0; color: #667085; font-size: 12px; }
.report-total { margin-top: 14px; padding-top: 12px; border-top: 1px solid #0097a0; border-bottom: 0; color: #007f87; font-family: Georgia, serif; font-size: 17px; font-weight: 600; }
.report-total strong { color: #007f87; font-size: 18px; }
.report-footer { display: grid; grid-template-columns: minmax(0, 1fr) 250px; align-items: end; column-gap: 30px; margin-top: auto; padding-top: 42px; }
.report-footer-meta { align-self: end; display: flex; justify-content: space-between; align-items: end; width: 100%; color: #667085; font-size: 10px; }
.signature-block { width: 250px; margin-left: auto; margin-top: 34px; display: flex; flex-direction: column; align-items: flex-end; text-align: right; color: #667085; font-size: 10px; }
.signature-line { width: 100%; margin-bottom: 6px; border-top: 1px solid #263238; }
.signature-block strong { margin-top: 14px; color: #1f2933; font-size: 12px; }
.signature-block > span:last-child { margin-top: 4px; }
</style>
</head>
<body>
<article class="report-page">
  <div class="report-letterhead-space"></div>
  <div class="report-content">
    <section class="report-section">
      <div class="report-section-heading"><h2>Patient Details</h2><time>${formatDate(calculation.created_at)}</time></div>
      <div class="report-details-grid">
        <div><span>Patient Name</span><strong>${escapeHtml(calculation.patient_name)}</strong></div>
        <div><span>Patient Age</span><strong>${calculation.patient_age}</strong></div>
        <div><span>Doctor</span><strong>${escapeHtml(calculation.doctor.name)}</strong></div>
        <div><span>Designation</span><strong>${escapeHtml(calculation.doctor.designation)}</strong></div>
      </div>
    </section>
    <section class="report-section">
      <h2>Treatment Details</h2>
      <div class="report-details-grid report-details-grid--four">
        <div><span>Limb Type</span><strong>${formatLimbType(calculation.limb_type)}</strong></div>
        <div><span>Volume</span><strong>${escapeHtml(calculation.volume)} Litres</strong></div>
        <div><span>Duration</span><strong>${calculation.duration_days} days</strong></div>
        <div><span>Financial Category</span><strong>${calculation.financial_category}</strong></div>
      </div>
    </section>
    <section class="report-section">
      <h2>Cost Breakdown</h2>
      <div class="report-cost-line report-base-line"><span>Base Treatment</span><strong>${formatCurrency(calculation.base_rate)}</strong></div>
      <div class="report-services-block"><div class="report-services-label">Additional Services</div>${renderServices(calculation)}</div>
      <div class="report-total"><span>Total Treatment Cost</span><strong>${formatCurrency(calculation.total_cost)}</strong></div>
    </section>
    <footer class="report-footer">
      <div class="report-footer-meta"><div>Report ID: <strong>#${calculation.id.padStart(6, "0")}</strong></div></div>
      <div class="signature-block"><div class="signature-line"></div><span>Signature</span><strong>${escapeHtml(calculation.signatory.name)}</strong><span>${escapeHtml(calculation.signatory.designation)}</span></div>
    </footer>
  </div>
</article>
</body>
</html>`;

export const generateCalculationPdf = async (calculation: CalculationForPdf): Promise<Buffer> => {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(renderReportHtml(calculation), { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
};
