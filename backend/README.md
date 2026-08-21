# Backend Technical Documentation

## Architecture

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

## Directory Structure

```text
backend/
├── .env
├── dist/
├── node_modules/
├── package.json
├── tsconfig.json
├── src/
│   ├── config/
│   │   └── database.ts
│   ├── controllers/
│   │   ├── adminPricingController.ts
│   │   ├── adminServiceController.ts
│   │   ├── authController.ts
│   │   ├── pricingController.ts
│   │   └── serviceController.ts
│   ├── middleware/
│   │   └── authMiddleware.ts
│   ├── routes/
│   │   ├── adminPricingRoutes.ts
│   │   ├── adminServiceRoutes.ts
│   │   ├── authRoutes.ts
│   │   ├── pricingRoutes.ts
│   │   └── serviceRoutes.ts
│   └── server.ts
└── scripts/
    └── (empty in current repo snapshot)
```

## Dependencies

From `backend/package.json`:

- `express` - HTTP server
- `cors` - CORS support
- `dotenv` - environment variable loading
- `pg` - PostgreSQL client
- `bcrypt` - password hashing / comparison
- `jsonwebtoken` - JWT sign and verify

Development dependencies:

- `typescript`
- `ts-node-dev`
- `@types/*` packages

## Express Setup

`server.ts`:

```ts
const app = express();
app.use(cors());
app.use(express.json());
```

Routes mounted:

- `/api/health`
- `/api/pricing`
- `/api/services`
- `/api/auth`
- `/api/admin/pricing`
- `/api/admin/services`

The server binds to `PORT` or falls back to `5000`.

## Database Pool

`src/config/database.ts` creates a shared PostgreSQL pool:

```ts
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
```

Runtime connection logging is attached through `pool.on()` handlers.

## Routes

### Public routes

- `GET /api/health`
- `GET /api/pricing`
- `GET /api/services`
- `POST /api/auth/login`

### Protected routes

- `GET /api/admin/pricing`
- `PUT /api/admin/pricing/:id`
- `GET /api/admin/services`
- `POST /api/admin/services`
- `PUT /api/admin/services/:id`

Implementation mapping:

- `pricingRoutes.ts` -> `pricingController.ts`
- `serviceRoutes.ts` -> `serviceController.ts`
- `authRoutes.ts` -> `authController.ts`
- `adminPricingRoutes.ts` -> `adminPricingController.ts`
- `adminServiceRoutes.ts` -> `adminServiceController.ts`

## Controllers

### `pricingController.ts`

`getPricing()` validates:

- `limbType`
- `volume`
- `duration`
- `financialCategory`

Then executes:

```sql
SELECT id, limb_type, duration_days, volume_range, financial_category, rate
FROM pricing_rates
WHERE limb_type = $1
  AND duration_days = $2
  AND volume_range @> $3::numeric
  AND financial_category = $4
```

Returns:

```json
{ "data": { ... } }
```

### `serviceController.ts`

`getActiveServices()` returns all active rows from `additional_services` in `id` order.

### `authController.ts`

`login()`:

1. gets `username` and `password` from body
2. queries `admins` by username
3. verifies password with `bcrypt.compare()`
4. signs JWT with `jsonwebtoken`
5. returns `token` and admin metadata

### `adminPricingController.ts`

- `getAllPricing()` -> `SELECT` all pricing rows
- `updatePricingRate()` -> updates `rate` for requested row ID, returns updated record

### `adminServiceController.ts`

- `getAllServices()` -> returns all rows, including inactive
- `createService()` -> validates input and inserts new service
- `updateService()` -> validates and updates `service_name`, `cost_per_day`, `active`

## Middleware

`authMiddleware.ts`:

- reads `Authorization` header
- requires `Bearer <token>`
- loads `JWT_SECRET`
- calls `jwt.verify()`
- attaches `{ adminId, username, iat, exp }` to `req.admin`
- returns `401` on missing/invalid/expired credentials

## Authentication

### Login flow

```text
POST /api/auth/login
  ↓
admins table
  ↓
bcrypt.compare()
  ↓
JWT signing
  ↓
response token
```

### JWT

- payload: `{ adminId, username }`
- expiration: `1h`
- secret source: `process.env.JWT_SECRET`

### Protected request behavior

When a request is routed through admin routes:

- `router.use(authMiddleware)` executes before controller handling
- the token is validated before database operations proceed
- `401` is returned when verification fails

## PostgreSQL Queries Reference

### Pricing lookup

```sql
SELECT
  id,
  limb_type,
  duration_days,
  volume_range,
  financial_category,
  rate
FROM pricing_rates
WHERE limb_type = $1
  AND duration_days = $2
  AND volume_range @> $3::numeric
  AND financial_category = $4
```

### Admin pricing list

```sql
SELECT
  id,
  limb_type,
  duration_days,
  volume_range,
  financial_category,
  rate
FROM pricing_rates
ORDER BY limb_type ASC, duration_days ASC, id ASC
```

### Admin pricing update

```sql
UPDATE pricing_rates
SET rate = $1
WHERE id = $2
RETURNING
  id,
  limb_type,
  duration_days,
  volume_range,
  financial_category,
  rate
```

### Services list

```sql
SELECT id, service_name, cost_per_day, active
FROM additional_services
WHERE active = TRUE
ORDER BY id
```

### Admin services list

```sql
SELECT id, service_name, cost_per_day, active
FROM additional_services
ORDER BY id ASC
```

### Service create

```sql
INSERT INTO additional_services (service_name, cost_per_day, active)
VALUES ($1, $2, TRUE)
RETURNING id, service_name, cost_per_day, active
```

### Service update

```sql
UPDATE additional_services
SET service_name = $1,
    cost_per_day = $2,
    active = $3
WHERE id = $4
RETURNING id, service_name, cost_per_day, active
```

## Response Shapes

### Pricing response

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

### Services response

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

### Auth response

```json
{
  "token": "jwt.token.here",
  "admin": {
    "id": 1,
    "username": "admin"
  }
}
```

## Error Handling

- `400` for invalid client input
- `401` for missing/invalid JWT or invalid credentials
- `404` for no pricing record or missing service
- `409` for duplicate service name
- `500` for runtime/internal database failures

## Environment Variables

```env
PORT=
DB_HOST=
DB_PORT=
DB_NAME=
DB_USER=
DB_PASSWORD=
JWT_SECRET=
```

## Commands

```bash
cd D:\hospital-costing\backend
npm install
npm run dev
npm run build
npm start
```

## Debugging Notes

- `server.ts` is the place to add startup-time middleware or route registration.
- `database.ts` is the connection source for all DB access.
- `authMiddleware.ts` is the clean gate for all admin-only endpoints.
- `pricingController.ts` is the source for the `NUMRANGE` lookup semantics.
- `adminServiceController.ts` is the source for duplicate and active/inactive rules.

## Cross-reference

The backend database schema and import flow are documented in the root README at the repository level.

## Current Routes

### Doctor routes

Public:

- `GET /api/doctors` - returns active doctors with `id`, `name`, and `designation`.
- `POST /api/calculations` - validates and saves a new `DRAFT` calculation.
- `GET /api/calculations/:id` - returns a saved calculation with its doctor object and historical service snapshots.
- `GET /api/calculations/:id/pdf` - returns a finalized calculation as an A4 PDF.

Admin-protected:

- `GET /api/admin/doctors` - returns active and inactive doctors.
- `POST /api/admin/doctors` - creates an active doctor.
- `PUT /api/admin/doctors/:id` - edits doctor fields or active status.

Calculation finalization:

- `PUT /api/calculations/:id/finalize` - changes `DRAFT` to `FINAL`; repeated finalization is idempotent.

The PDF endpoint returns `409` while a calculation is still `DRAFT`, `404` when it does not exist, and `500` when generation fails.

## Calculation Persistence

`calculation_records` stores the complete historical calculation. The `services` JSONB column contains service snapshots with:

```json
{
  "service_id": 1,
  "service_name": "ULCER CARE",
  "cost_per_day": 400,
  "duration_days": 7,
  "total_cost": 2800
}
```

The create controller validates doctor activity, patient details, treatment fields, service snapshot structure, and total consistency before insertion. It calculates stored totals from the supplied snapshots rather than trusting the submitted aggregate values.

## Playwright PDF Generation

PDF generation is implemented in `src/services/pdfService.ts` with `playwright` and Chromium. The service:

- receives calculation data from the controller
- builds the approved report HTML structure
- reserves the 50mm letterhead area
- uses A4 portrait printing with background colors
- returns a PDF buffer

Install the backend package and Chromium browser once:

```powershell
npm install
npx playwright install chromium
```

The response uses:

```text
Content-Type: application/pdf
Content-Disposition: attachment; filename="calculation-report-000001.pdf"
```

## Doctors Table

The runtime schema is:

```sql
CREATE TABLE doctors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  designation VARCHAR(160) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

No doctor passwords, images, or authentication credentials are stored.

## Audit Record Context

`audit_logs.record_context JSONB` stores historical identifying fields without removing `entity_id`:

Pricing:

```json
{
  "limb_type": "UNILATERAL",
  "volume_range": "[0,2.0)",
  "duration_days": 7,
  "financial_category": 1
}
```

Services store `{ "service_name": "ULCER CARE" }`. The context is written inside the existing pricing/service transactions and returned by `GET /api/admin/audit-logs`.

The migration is recorded at `database/migrations/003_add_audit_record_context.sql`. Existing audit rows may contain `NULL` context.

## Current Build Checks

```powershell
npm run build
```

For local PDF verification, start the server after installing Chromium:

```powershell
npm run dev
```
