# Repository Technical Map

## Architecture

```text
React Frontend
      ↓
Axios Service Layer
      ↓
Express REST API
      ↓
Middleware
      ↓
Controllers
      ↓
PostgreSQL
```

```text
Excel
  ↓
import_excel.py
  ↓
PostgreSQL
```

- `COSTING.xlsx` is the import/source spreadsheet file.
- `import_excel.py` reads the spreadsheet and writes normalized pricing/service data into PostgreSQL.
- PostgreSQL is the runtime data source used by the backend at runtime.

## Repository Structure

```text
.
├── .gitignore
├── COSTING.xlsx
├── import_excel.py
├── README.md
├── venv/
├── backend/
│   ├── .env
│   ├── dist/
│   ├── node_modules/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── config/
│       │   └── database.ts
│       ├── controllers/
│       │   ├── adminPricingController.ts
│       │   ├── adminServiceController.ts
│       │   ├── authController.ts
│       │   ├── pricingController.ts
│       │   └── serviceController.ts
│       ├── middleware/
│       │   └── authMiddleware.ts
│       ├── routes/
│       │   ├── adminPricingRoutes.ts
│       │   ├── adminServiceRoutes.ts
│       │   ├── authRoutes.ts
│       │   ├── pricingRoutes.ts
│       │   └── serviceRoutes.ts
│       └── server.ts
└── frontend/
    ├── dist/
    ├── node_modules/
    ├── package.json
    ├── README.md
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── index.css
        ├── main.tsx
        ├── pages/
        │   ├── admin/
        │   │   ├── AdminDashboard.tsx
        │   │   ├── AdminLogin.tsx
        │   │   ├── PricingManagement.tsx
        │   │   └── ServicesManagement.tsx
        │   └── doctor/
        │       └── DoctorDashboard.tsx
        ├── services/
        │   ├── adminPricingService.ts
        │   ├── adminServiceService.ts
        │   ├── api.ts
        │   ├── authService.ts
        │   └── pricingService.ts
        └── types/
            └── pricing.ts
```

### Responsibility Summary

- `import_excel.py`: Python importer for spreadsheet-to-PostgreSQL ingestion.
- `backend/src/server.ts`: Express app bootstrap and route mounting.
- `backend/src/config/database.ts`: PostgreSQL `pg` pool configuration.
- `backend/src/routes/*`: HTTP path registration.
- `backend/src/controllers/*`: request validation, database queries, response encoding.
- `backend/src/middleware/authMiddleware.ts`: JWT validation for admin-only endpoints.
- `frontend/src/App.tsx`: BrowserRouter route configuration.
- `frontend/src/pages/*`: screen-level UI composition.
- `frontend/src/services/*`: backend API client wrappers and auth helpers.
- `frontend/src/types/pricing.ts`: TypeScript DTOs for pricing and service records.

## Backend Architecture

```text
HTTP Request
    ↓
Express Router
    ↓
Middleware
    ↓
Controller
    ↓
pg Pool
    ↓
PostgreSQL
    ↓
JSON Response
```

### `server.ts`

- Instantiates Express.
- Loads environment variables via `dotenv.config()`.
- Enables CORS and JSON body parsing.
- Exposes health endpoint at `/api/health`.
- Mounts:
  - `/api/pricing`
  - `/api/services`
  - `/api/auth`
  - `/api/admin/pricing`
  - `/api/admin/services`
- Starts the process on `PORT` or `5000`.

### `database.ts`

- Creates a shared PostgreSQL `Pool`.
- Reads connection settings from environment variables:
  - `DB_HOST`
  - `DB_PORT`
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASSWORD`
- Logs connection and pool errors through `pool.on()` handlers.

### Routes

Public routes:

- `GET /api/health`
- `GET /api/pricing`
- `GET /api/services`
- `POST /api/auth/login`

Protected routes:

- `GET /api/admin/pricing`
- `PUT /api/admin/pricing/:id`
- `GET /api/admin/services`
- `POST /api/admin/services`
- `PUT /api/admin/services/:id`

Protected routes use `authMiddleware` via `router.use(authMiddleware)`.

### Controllers

- `pricingController.ts`: public pricing lookup by limb type, volume, duration, and financial category.
- `serviceController.ts`: public list of active additional services.
- `authController.ts`: admin login with `bcrypt.compare()` and JWT generation.
- `adminPricingController.ts`: admin pricing read/update operations.
- `adminServiceController.ts`: admin read/create/update operations.

### Middleware

`authMiddleware.ts`:

- Reads `Authorization` header.
- Requires `Bearer <token>` format.
- Reads `JWT_SECRET` from environment.
- Verifies the JWT with `jwt.verify()`.
- Attaches `req.admin` with `adminId` and `username`.
- Returns `401` for missing/invalid/expired tokens.

## API Reference

### GET /api/health

Auth: Public

Response:

```json
{
  "status": "OK",
  "message": "Hospital Costing API is running"
}
```

Error codes:

- `200` on success

### GET /api/pricing

Auth: Public

Query parameters:

- `limbType` (required)
- `volume` (required, numeric)
- `duration` (required, numeric; accepted: 7, 10, 14, 21)
- `financialCategory` (required, numeric; accepted: 1, 2, 3, 4)

Response:

```json
{
  "data": {
    "id": "...",
    "limb_type": "UNILATERAL",
    "duration_days": 7,
    "volume_range": "[2,3)",
    "financial_category": 1,
    "rate": "1234.56"
  }
}
```

Error codes:

- `400`: missing or invalid query values
- `404`: no matching rate
- `500`: internal error

### GET /api/services

Auth: Public

Response:

```json
{
  "data": [
    {
      "id": "...",
      "service_name": "X-ray",
      "cost_per_day": "500",
      "active": true
    }
  ]
}
```

Error codes:

- `200` on success
- `500` on internal error

### POST /api/auth/login

Auth: Public

Request body:

```json
{
  "username": "admin",
  "password": "secret"
}
```

Response:

```json
{
  "token": "jwt.token.here",
  "admin": {
    "id": 1,
    "username": "admin"
  }
}
```

Error codes:

- `400`: missing `username` or `password`
- `401`: invalid credentials
- `500`: JWT secret missing or internal server error

### GET /api/admin/pricing

Auth: Required (`Bearer <token>`)

Response:

```json
{
  "data": [
    {
      "id": "...",
      "limb_type": "UNILATERAL",
      "duration_days": 7,
      "volume_range": "[2,3)",
      "financial_category": 1,
      "rate": "1234.56"
    }
  ]
}
```

Error codes:

- `401`: missing/invalid/expired token
- `500`: internal error

### PUT /api/admin/pricing/:id

Auth: Required (`Bearer <token>`)

Request body:

```json
{
  "rate": 1500
}
```

Response:

```json
{
  "data": {
    "id": "...",
    "limb_type": "UNILATERAL",
    "duration_days": 7,
    "volume_range": "[2,3)",
    "financial_category": 1,
    "rate": "1500"
  }
}
```

Error codes:

- `400`: missing/invalid `id`, invalid numeric `rate`
- `404`: pricing row not found
- `401`: missing/invalid/expired token
- `500`: internal error

### GET /api/admin/services

Auth: Required (`Bearer <token>`)

Response:

```json
{
  "data": [
    {
      "id": "...",
      "service_name": "Physiotherapy",
      "cost_per_day": "500",
      "active": true
    }
  ]
}
```

Error codes:

- `401`: missing/invalid/expired token
- `500`: internal error

### POST /api/admin/services

Auth: Required (`Bearer <token>`)

Request body:

```json
{
  "service_name": "Physiotherapy",
  "cost_per_day": 500
}
```

Response:

```json
{
  "data": {
    "id": "...",
    "service_name": "Physiotherapy",
    "cost_per_day": "500",
    "active": true
  }
}
```

Error codes:

- `400`: missing/invalid input
- `401`: missing/invalid/expired token
- `409`: duplicate `service_name`
- `500`: internal error

### PUT /api/admin/services/:id

Auth: Required (`Bearer <token>`)

Request body:

```json
{
  "service_name": "Physiotherapy Updated",
  "cost_per_day": 550,
  "active": true
}
```

Response:

```json
{
  "data": {
    "id": "...",
    "service_name": "Physiotherapy Updated",
    "cost_per_day": "550",
    "active": true
  }
}
```

Error codes:

- `400`: invalid update payload
- `401`: missing/invalid/expired token
- `404`: service not found
- `409`: duplicate `service_name`
- `500`: internal error

## Authentication Architecture

```text
POST /api/auth/login
    ↓
admins table
    ↓
bcrypt.compare()
    ↓
JWT signing
    ↓
token
    ↓
frontend localStorage
    ↓
Axios request interceptor
    ↓
Authorization: Bearer <token>
    ↓
JWT middleware
    ↓
Admin controller
```

### Actual implementation

- `authController.ts` queries `admins` by `username`.
- `bcrypt.compare(password, admin.password_hash)` validates the submitted credential.
- If valid, it reads `process.env.JWT_SECRET` and signs a JWT with:
  - payload: `{ adminId, username }`
  - expiration: `1h`
- Response includes `token` and `admin` object.
- `AdminLogin.tsx` stores:
  - `adminToken` in `localStorage`
  - `admin` in `localStorage`
- `api.ts` request interceptor adds `Authorization: Bearer <token>` for non-public URLs.
- Public routes are defined in `publicApiPaths`:
  - `/pricing`
  - `/services`
  - `/health`
  - `/auth/login`
- `authMiddleware.ts` checks `Authorization` header format and verifies JWT using `JWT_SECRET`.
- On verification failure, it returns `401` with message `Invalid or expired token`.
- `api.ts` response interceptor removes localStorage auth state and redirects to `/admin/login` when a protected request returns `401`.
- `AdminDashboard.tsx` checks for stored token/admin and redirects to `/admin/login` when missing.
- `logout` clears `adminToken` and `admin` from localStorage and navigates to `/admin/login`.

### JWT payload and behavior

```ts
{
  adminId: number;
  username: string;
  iat?: number;
  exp?: number;
}
```

The JWT is created in `authController.ts` with `jwt.sign(..., { expiresIn: '1h' })`.

### Secret source

`JWT_SECRET` is read from the environment via `process.env.JWT_SECRET` in both the login controller and the auth middleware. No secret value is committed to source control.

## Database Schema

The repository does not include a migration or DDL file. The schema below is inferred from the runtime queries in `controllers/*` and the importer in `import_excel.py`.

### Database name

- `hospital_costing`

### PostgreSQL version

- Not explicitly stored in the repo. Version is not documented in the source files checked in.

### Tables

#### `pricing_rates`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | integer / serial-like identifier | primary key implied by query results | Row identifier |
| `limb_type` | text / varchar-like | used for lookup and upsert keys | `UNILATERAL` or `BILATERAL` |
| `duration_days` | integer | used in query filters and conflict key | 7, 10, 14, 21 |
| `volume_range` | `numrange` | PostgreSQL range typed column | Range used for numeric lookup |
| `financial_category` | integer | lookup and conflict key | 1 to 4 |
| `rate` | numeric / decimal-like | numeric currency value | Base cost for a pricing row |

Likely unique constraint used by importer:

```sql
(limb_type, duration_days, volume_range, financial_category)
```

This is inferred from Upsert logic in `import_excel.py`:

```sql
ON CONFLICT (limb_type, duration_days, volume_range, financial_category)
DO UPDATE SET rate = EXCLUDED.rate;
```

#### `additional_services`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | integer / serial-like identifier | primary key implied by query results | Row identifier |
| `service_name` | text / varchar-like | unique key used in importer | service label |
| `cost_per_day` | numeric / decimal-like | nullable not implied by app | per-day cost |
| `active` | boolean | toggled by admin update and defaulted to TRUE on insert | service visibility flag |

Likely unique constraint used by importer:

```sql
(service_name)
```

#### `admins`

| Column | Type | Constraints | Description |
| --- | --- | --- | --- |
| `id` | integer / serial-like identifier | primary key implied by query results | admin record identifier |
| `username` | text / varchar-like | lookup key | login username |
| `password_hash` | text / varchar-like | hashed password for comparison | bcrypt hash |

The admin table is queried as:

```sql
SELECT id, username, password_hash
FROM admins
WHERE username = $1
```

### `NUMRANGE` semantics

`volume_range` is a PostgreSQL `NUMRANGE` column. The importer generates values like:

- `< 2L` -> `[0,2)`
- `2 - 3L` -> `[2,3)`
- `3-4L` -> `[3,4)`

Example:

```text
[2.0,3.0)
```

means:

```text
2.0 <= volume < 3.0
```

The public pricing lookup uses:

```sql
volume_range @> $3::numeric
```

This tests whether the numeric volume falls inside the range.

## Data Import (`import_excel.py`)

### Inputs

- `COSTING.xlsx`
- PostgreSQL credentials entered interactively via `getpass.getpass()`

### Processing

- Python 3 script
- `pandas.read_excel()` for workbook parsing
- `psycopg2` for database connection and bulk inserts
- `psycopg2.extras.execute_values()` for batch writes

### Sheet interpretation

#### `UNILATERAL` and `BILATERAL` sheets

The importer calls:

```python
parse_pricing_sheet(file_path, "UNILATERAL", "UNILATERAL")
parse_pricing_sheet(file_path, "BILATERAL", "BILATERAL")
```

For each row:

1. Search the first three cells for a duration like `7 Days`, `10 Days`, `14 Days`, or `21 Days`.
2. Detect the `Limb Size` header row to collect column positions for volume ranges.
3. Read the first column value as a financial category if it is a numeric `1`, `2`, `3`, or `4`.
4. For each volume-range column, append a rate record.

#### `ADDITIONAL` sheet

The importer reads:

```python
parse_additional_services(file_path)
```

It reads `sheet_name="ADDITIONAL"` and extracts:

- column index `1` => service name
- column index `2` => cost per day

It skips blank rows and the literal `SERVICES` header, then converts `cost` to `float`.

### Unilateral/bilateral mapping

- `limb_type` is hardcoded to `UNILATERAL` or `BILATERAL` based on sheet name.
- `duration_days` is parsed from strings such as `LF UL 7 Days`.
- `financial_category` is read from the first column as a numeric value `1..4`.
- `volume_range` is generated from Excel labels like `< 2L` and `2 - 3L` using `parse_volume_range()`.

### Range generation

```python
def parse_volume_range(value):
```

Converts labels into PostgreSQL `NUMRANGE` strings:

- `<2L` -> `[0,2)`
- `2-3L` -> `[2,3)`

### Duplicate handling

Pricing rows are inserted with:

```sql
ON CONFLICT (limb_type, duration_days, volume_range, financial_category)
DO UPDATE SET rate = EXCLUDED.rate;
```

Additional services are inserted with:

```sql
ON CONFLICT (service_name)
DO UPDATE SET
  cost_per_day = EXCLUDED.cost_per_day,
  active = TRUE;
```

This means:

- pricing record updates replace the rate for same key
- service names are de-duplicated by `service_name`
- service active state is reset to `TRUE` on re-import

### Output

The importer writes to PostgreSQL tables:

- `pricing_rates`
- `additional_services`

## Frontend Architecture

```text
React
  ↓
Pages
  ↓
Service Layer
  ↓
Axios
  ↓
Backend
```

### `App.tsx`

- Configures `BrowserRouter`.
- Registers routes for the doctor calculator and admin screens.
- Default fallback route redirects unknown paths to `/`.

### `main.tsx`

- Creates the React root.
- Loads `index.css` and mounts `App`.

### `pages/`

- `doctor/DoctorDashboard.tsx`: treatment cost calculator.
- `admin/AdminLogin.tsx`: admin login screen.
- `admin/AdminDashboard.tsx`: admin landing page and route navigation.
- `admin/PricingManagement.tsx`: admin pricing list/edit UI.
- `admin/ServicesManagement.tsx`: admin additional-services list/create/edit/deactivate UI.

### `services/`

- `api.ts`: shared Axios client and auth interceptors.
- `pricingService.ts`: public doctor pricing calls and active services calls.
- `adminPricingService.ts`: admin pricing read/update service wrapper.
- `adminServiceService.ts`: admin service read/create/update service wrapper.
- `authService.ts`: localStorage auth helpers and API login helper.

### `types/`

- `pricing.ts`: DTOs for `PricingRate`, `AdditionalService`, and API response wrappers.

## Frontend Routes

```text
/
/admin/login
/admin
/admin/pricing
/admin/services
```

### Actual routing

`App.tsx` configures:

- `/` -> `DoctorDashboard`
- `/admin/login` -> `AdminLogin`
- `/admin` -> `AdminDashboard`
- `/admin/pricing` -> `PricingManagement`
- `/admin/services` -> `ServicesManagement`
- fallback -> redirect to `/`

### Protection behavior

`AdminDashboard.tsx` checks for `adminToken` in localStorage on mount. If absent, it redirects to `/admin/login`.

`api.ts` also guards protected API requests by attaching an Authorization header only when the current route is not in the public URL allowlist.

`api.ts` response interceptor removes auth from localStorage and redirects to `/admin/login` when a protected request returns `401`.

## Frontend Service Layer

### `api.ts`

- Creates Axios client with `baseURL: 'http://localhost:5000/api'`.
- Request interceptor:
  - reads `adminToken`
  - skips public API paths
  - sets `Authorization: Bearer <token>` for protected requests
- Response interceptor:
  - on `401`, clears localStorage auth values
  - redirects to `/admin/login`

### `pricingService.ts`

- `getPricing(limbType, volume, duration, financialCategory)`
  - endpoint: `GET /pricing`
  - params: `limbType`, `volume`, `duration`, `financialCategory`
  - output: `PricingResponse`
  - types: `PricingResponse`, `PricingRate`
  - auth: public

- `getAdditionalServices()`
  - endpoint: `GET /services`
  - output: `ServicesResponse`
  - auth: public

### `adminPricingService.ts`

- `getAdminPricing()`
  - endpoint: `GET /admin/pricing`
  - output: `PricingRate[]`
  - auth: required via request interceptor

- `updatePricingRate(id, rate)`
  - endpoint: `PUT /admin/pricing/:id`
  - body: `{ rate }`
  - output: `PricingRate`
  - auth: required via request interceptor

### `adminServiceService.ts`

- `getAdminServices()`
  - endpoint: `GET /admin/services`
  - output: `AdditionalService[]`
  - auth: required

- `createService(service_name, cost_per_day)`
  - endpoint: `POST /admin/services`
  - body: `{ service_name, cost_per_day }`
  - output: `AdditionalService`
  - auth: required

- `updateService(id, data)`
  - endpoint: `PUT /admin/services/:id`
  - body: `{ service_name?, cost_per_day?, active? }`
  - output: `AdditionalService`
  - auth: required

### `authService.ts`

- `login(username, password)`
  - endpoint: `POST /auth/login`
  - body: `{ username, password }`
  - output: `{ token, admin }`
  - auth: public
- `getStoredAdmin()` and `getStoredAdminToken()` read `localStorage`
- `clearAdminSession()` removes auth state
- `logout()` clears session and navigates to `/admin/login`

## State Flow

### Doctor state flow

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

Actual behavior:

- `DoctorDashboard.tsx` stores form values in `formData`.
- `handleSubmit` validates `limbType`, `volume`, `duration`, and `financialCategory`.
- Calls `getPricing` from `pricingService.ts`.
- Stores `pricing` result in component state.
- Calls `getAdditionalServices()` and stores `services`/`selectedServices`.
- Renders base treatment, selected service totals, and total estimate.

### Additional services state flow

```text
getAdditionalServices()
  ↓
React state
  ↓
checkbox selection
  ↓
cost calculation
  ↓
render
```

Actual behavior:

- `services` are loaded into local component state.
- `selectedServices` is a map keyed by service id.
- `additionalServicesTotal` in `DoctorDashboard.tsx` sums `Number(service.cost_per_day) * Number(formData.duration)` for selected services.
- Total is computed as `baseTreatment + additionalServicesTotal`.

### Admin pricing state flow

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

Actual behavior:

- `getAdminPricing()` fetches all records.
- `records` is stored in `PricingManagement.tsx`.
- `filteredRecords` applies search + filter + pagination in client state.
- `editingId` and `draftRate` control the edit form.
- `updatePricingRate` sends `PUT /admin/pricing/:id` and updates matching row in `setRecords()`.

### Admin services state flow

```text
GET
POST
PUT
  ↓
React state update
```

Actual behavior:

- `ServicesManagement.tsx` loads all services on mount.
- `createService` appends returned row to `services` state.
- `updateService` updates the matching record in place.
- Deactivation sets `active: false` and the list is re-rendered from state.

## Pricing Logic

### Public lookup

The backend pricing query is:

```sql
SELECT id, limb_type, duration_days, volume_range, financial_category, rate
FROM pricing_rates
WHERE limb_type = $1
  AND duration_days = $2
  AND volume_range @> $3::numeric
  AND financial_category = $4
```

Inputs:

- `limbType`
- `volume`
- `duration`
- `financialCategory`

The pricing row is retrieved from the backend via `GET /api/pricing`.

### Numeric range lookup

The query uses PostgreSQL range containment:

```sql
volume_range @> $3::numeric
```

Given a `NUMRANGE`, this tests whether the provided numeric volume falls inside the stored range.

### Additional service calculation

Frontend calculation:

```ts
Number(service.cost_per_day) * Number(formData.duration)
```

This is the service subtotal for a selected service across the selected treatment duration.

### Total calculation

```ts
baseTreatment + additionalServicesTotal
```

Where:

- `baseTreatment` = `Number(pricing.rate)`
- `additionalServicesTotal` = sum of selected services × duration

## Error Handling

### Backend

`pricingController.ts`

- `400` for missing or invalid query params
- `404` when no record matches the lookup
- `500` on unexpected runtime errors

`authController.ts`

- `400` for missing credentials
- `401` for invalid password or username
- `500` when `JWT_SECRET` is undefined or internal error occurs

`authMiddleware.ts`

- `401` for missing Authorization header
- `401` for malformed header
- `401` for invalid or expired JWT
- `500` when `JWT_SECRET` is not configured

`adminPricingController.ts`

- `400` invalid `id` or `rate`
- `404` no matching pricing row
- `500` internal error

`adminServiceController.ts`

- `400` invalid payload
- `404` service not found
- `409` duplicate service name
- `500` internal error

### Axios

`api.ts`:

- request interceptor adds token for protected endpoints
- response interceptor checks `error.response?.status === 401`
- clears auth state and redirects to `/admin/login` for protected routes

### React component handling

Observed in the UI:

- `DoctorDashboard.tsx` sets error messages based on `400` and `404` pricing responses.
- `AdminLogin.tsx` surfaces credentials/auth errors from backend responses.
- `PricingManagement.tsx` and `ServicesManagement.tsx` set loading/error/success state around fetch, create, edit, and deactivation flows.

## Environment Configuration

Create environment variables in the backend runtime configuration. Do not commit actual secret values.

```env
PORT=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
JWT_SECRET=
```

`backend/src/config/database.ts` reads:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

`authController.ts` and `authMiddleware.ts` read:

- `JWT_SECRET`

## Development Commands

### Backend

```bash
cd D:\hospital-costing\backend
npm install
npm run dev
npm run build
npm start
```

- `npm run dev`: `ts-node-dev --respawn --transpile-only src/server.ts`
- `npm run build`: `tsc`
- `npm start`: `node dist/server.js`

### Frontend

```bash
cd D:\hospital-costing\frontend
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

### Python importer

The importer is not wired to a package script in the repo. It is run directly:

```bash
cd D:\hospital-costing
python import_excel.py
```

## Git / Ignored Files

Important ignored files and directories from `.gitignore`:

- `backend/.env`
- `COSTING.xlsx`
- `backend/node_modules/`
- `backend/dist/`
- `venv/`
- `__pycache__/`
- `*.pyc`

Technical reasons:

- environment variables should not be tracked
- spreadsheet source data is large and local only
- dependency install output should not be checked in
- Python virtualenv should not be versioned
- compiled/transpiled output should not be tracked

## Current Implementation Status

Implemented:

- Express API service bootstrapped in `backend/src/server.ts`
- public pricing and service endpoints
- admin login with bcrypt and JWT
- protected admin routes using middleware
- PostgreSQL connection pool and runtime queries
- frontend React doctor calculator UI
- admin pricing management page with filters and inline edit
- admin additional-services management page with create/edit/deactivate flow
- Axios auth interceptor and redirect on 401
- Excel import script for pricing and services ingestion

Not implemented:

- no database migration files are checked into the repo
- no reusable admin role model beyond single JWT-based admin session flow
- no automated test suite in the repo
- no CI pipeline configuration checked in
- no separate SQL schema versioning for PostgreSQL objects

## Repository Notes for AI / Developer Use

- Source of truth for backend data schema is the runtime query usage, not a migration script.
- Source of truth for frontend route and auth behavior is the React router and Axios interceptor configuration.
- The admin auth model is localStorage-based, not server-side session storage.
- The `volume_range` query uses PostgreSQL `NUMRANGE` containment, not a simple numeric column comparison.
- The importer uses upserts rather than full table rebuilds.
