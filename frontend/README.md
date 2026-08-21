# Frontend Technical Documentation

## React Architecture

```text
React
  ↓
Pages
  ↓
Service layer
  ↓
Axios
  ↓
Backend
```

## Directory Structure

```text
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── src/
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminLogin.tsx
│   │   │   ├── PricingManagement.tsx
│   │   │   └── ServicesManagement.tsx
│   │   └── doctor/
│   │       └── DoctorDashboard.tsx
│   ├── services/
│   │   ├── adminPricingService.ts
│   │   ├── adminServiceService.ts
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   └── pricingService.ts
│   └── types/
│       └── pricing.ts
└── dist/
```

## App Bootstrap

### `main.tsx`

- creates the root React node
- imports `index.css`
- mounts `App`

### `App.tsx`

Routes defined:

```tsx
<Route path="/" element={<DoctorDashboard />} />
<Route path="/admin/login" element={<AdminLogin />} />
<Route path="/admin" element={<AdminDashboard />} />
<Route path="/admin/pricing" element={<PricingManagement />} />
<Route path="/admin/services" element={<ServicesManagement />} />
<Route path="*" element={<Navigate to="/" replace />} />
```

## Pages

### `pages/doctor/DoctorDashboard.tsx`

Responsibilities:

- form state for limb type, volume, duration, and financial category
- public pricing lookup via `getPricing()`
- public additional-services fetch via `getAdditionalServices()`
- checkbox selection for optional services
- cost calculation:
  - base rate from pricing response
  - selected services × duration
  - total = base + service cost
- loading/error states

### `pages/admin/AdminLogin.tsx`

Responsibilities:

- email/username + password input
- call `login(username, password)` from auth service
- persist `adminToken` and `admin` in `localStorage`
- redirect to `/admin` on successful auth

### `pages/admin/AdminDashboard.tsx`

Responsibilities:

- checks auth token in localStorage on mount
- redirects to `/admin/login` if missing
- renders navigation to:
  - `/admin`
  - `/admin/pricing`
  - `/admin/services`
- handles logout by clearing localStorage and navigating

### `pages/admin/PricingManagement.tsx`

Responsibilities:

- fetch all admin pricing rows with `getAdminPricing()`
- filter by limb type, duration, financial category, and search text
- paginate results
- inline edit for `rate`
- save through `updatePricingRate(id, rate)`
- success/error messaging for update actions

### `pages/admin/ServicesManagement.tsx`

Responsibilities:

- fetch all services via `getAdminServices()`
- filter by text and active/inactive status
- create new service via `createService()`
- inline edit and save via `updateService()`
- deactivate service by setting `active: false`
- confirmation block before deactivation

## Service Layer

### `services/api.ts`

Shared Axios instance:

```ts
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});
```

Public URL allowlist:

- `/pricing`
- `/services`
- `/health`
- `/auth/login`

Request interceptor:

- reads `adminToken` from `localStorage`
- attaches `Authorization: Bearer <token>` for non-public requests

Response interceptor:

- if `401` and route is protected, clears `adminToken` and `admin`
- redirects to `/admin/login`

### `services/pricingService.ts`

```ts
getPricing(limbType, volume, duration, financialCategory)
getAdditionalServices()
```

Endpoints:

- `GET /pricing`
- `GET /services`

Query params and result shape match backend API contract.

### `services/adminPricingService.ts`

```ts
getAdminPricing(): Promise<PricingRate[]>
updatePricingRate(id, rate): Promise<PricingRate>
```

Endpoints:

- `GET /admin/pricing`
- `PUT /admin/pricing/:id`

### `services/adminServiceService.ts`

```ts
getAdminServices(): Promise<AdditionalService[]>
createService(service_name, cost_per_day): Promise<AdditionalService>
updateService(id, data): Promise<AdditionalService>
```

Endpoints:

- `GET /admin/services`
- `POST /admin/services`
- `PUT /admin/services/:id`

### `services/authService.ts`

```ts
login(username, password)
getStoredAdmin()
getStoredAdminToken()
clearAdminSession()
logout(navigate)
```

Uses `localStorage` for session persistence.

## Axios Configuration

`api.ts` is the central client for all backend calls. It performs:

- base URL resolution
- auth header injection
- protected-route 401 cleanup and redirect

Authentication contract:

```http
Authorization: Bearer <token>
```

## Authentication State

Stored in localStorage:

- `adminToken`
- `admin`

Mechanics:

- login saves both values
- dashboard checks both values
- logout removes both values
- unauthorized API responses trigger a redirect to `/admin/login`

## Types

`src/types/pricing.ts` defines:

```ts
export type LimbType = "UNILATERAL" | "BILATERAL";
export type FinancialCategory = 1 | 2 | 3 | 4;
export type TreatmentDuration = 7 | 10 | 14 | 21;

export interface PricingRate { ... }
export interface AdditionalService { ... }
export interface PricingResponse { ... }
export interface ServicesResponse { ... }
```

Important details:

- `volume_range` is typed as `string` because it is transported as a Postgres range string like `[2,3)`.
- `rate` and `cost_per_day` are stored as strings in the current app DTOs and converted with `Number(...)` at calculation time.

## Doctor State Flow

```text
Form state
  ↓
getPricing()
  ↓
API response
  ↓
React state
  ↓
render
```

Actual steps:

1. `DoctorDashboard` updates `formData` for each input.
2. user submits the form
3. `handleSubmit()` validates fields
4. `getPricing()` calls `GET /pricing`
5. response is saved to `pricing` state
6. `getAdditionalServices()` loads available service options
7. totals render from `pricing` + selected service state

## Admin State Flow

### Admin pricing

```text
GET pricing
  ↓
React state
  ↓
frontend filters
  ↓
pagination
  ↓
edit state
  ↓
PUT
  ↓
React state update
```

### Admin services

```text
GET
POST
PUT
  ↓
React state update
```

## Pricing Management UI

`PricingManagement.tsx` does:

- fetches all pricing records
- applies local filters and pagination
- supports inline editing of the `rate` field
- saves via `PUT /admin/pricing/:id`
- updates the local record list after success

## Services Management UI

`ServicesManagement.tsx` does:

- fetches all services
- supports add/create form
- supports inline updates
- toggles `active` state
- deactivates via explicit confirm step

## API Response Mapping

Frontend layer expects backend wrappers like:

```json
{ "data": ... }
```

Examples:

- `PricingResponse.data`
- `ServicesResponse.data`
- `AdminServicesResponse.data`
- `AdminServiceResponse.data`

This matches the backend response contract used by Express controllers.

## Loading / Error States

Implemented states in the UI include:

- `loading` while fetching data
- `error` banners for failed fetch/update operations
- `successMessage` for successful create/update actions
- form validation messages for missing/invalid values

## Commands

```bash
cd D:\hospital-costing\frontend
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Build Process

The production build uses Vite and TypeScript:

```bash
npm run build
```

The underlying script:

```json
"build": "tsc -b && vite build"
```

## Cross-reference

Backend API, auth behavior, and database schema details are documented in the repository root README and backend README.

## Current Routes

```text
/                         Login selection
/admin/login              Admin login
/admin                    Admin dashboard
/admin/pricing            Pricing management
/admin/services           Additional service management
/admin/doctors            Doctor management
/admin/audit-logs          Audit history
/doctor/login             Doctor selection
/doctor                   Doctor calculator
/doctor/report/:id         Saved calculation report
```

## Doctor Selection

`DoctorLogin.tsx` loads active profiles from `GET /api/doctors`. Selecting a profile stores only this identity in `localStorage` under `selectedDoctor`:

```json
{
  "id": 7,
  "name": "Dr S R Narahari",
  "designation": "MD, DVD (Modern Dermatology)"
}
```

The doctor dashboard displays the selected identity and clears it when the doctor logs out. No doctor password or JWT is used.

## Calculation and Report Flow

`DoctorDashboard.tsx` collects patient details and existing treatment fields, calculates the cost using the current pricing/service APIs, and saves a historical snapshot through `POST /api/calculations`.

The report page loads saved data through `GET /api/calculations/:id`. It displays the database doctor details, patient details, treatment details, saved base rate, saved JSONB service snapshots, total, report ID, and created date. The report reserves 50mm for physical letterhead.

Draft reports can be finalized through `PUT /api/calculations/:id/finalize`. Final reports expose the Download PDF action and hide Edit Calculation. PDF generation is handled by the backend Playwright endpoint `GET /api/calculations/:id/pdf`.

## PDF Download

The frontend requests a finalized PDF as a binary Axios response:

```text
GET /api/calculations/:id/pdf
```

The browser downloads the backend-generated file using:

```text
calculation-report-000001.pdf
```

The frontend does not generate PDFs and does not query pricing or service APIs during download.

## Admin Audit History

The Audit History page keeps only the Section and Action filters. It receives `record_context` directly from the audit API and formats human-readable Record values without additional pricing or service requests:

- pricing: `Unilateral · 0–2 L · 7 days · Category 1`
- service: `ULCER CARE`
- missing context: `Record #1`

The Admin column remains visible as historical audit information, but there is no Admin filter.

## Additional Frontend Services

- `doctorService.ts`: public doctor lookup and selected-doctor session state.
- `adminDoctorService.ts`: admin-only doctor management.
- `calculationService.ts`: create, retrieve, finalize, and download calculation reports.
- `auditService.ts`: audit log retrieval with record context.

## Current Verification

```powershell
npm run build
npx eslint src/pages/admin/AuditLogs.tsx src/services/auditService.ts
npx eslint src/pages/doctor/CalculationReportPlaceholder.tsx src/services/calculationService.ts
```

