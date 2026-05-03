# E-Commerce REST API

A production-ready, scalable e-commerce REST API built with **Node.js**, **Express 5**, **TypeScript**, and **PostgreSQL**. Features JWT authentication, role-based access control, full CRUD operations, input validation, pagination, and structured error handling.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Products](#products)
  - [Users](#users)
  - [Orders](#orders)
- [Error Handling](#error-handling)
- [Pagination](#pagination)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Framework | Express 5 |
| Language | TypeScript 5.9 |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Validation | Zod v4 |
| Authentication | JSON Web Tokens (JWT) |
| Password Hashing | bcryptjs |
| Logging | Pino |
| Package Manager | pnpm (workspaces monorepo) |

---

## Architecture

```
├── artifacts/
│   └── api-server/
│       └── src/
│           ├── lib/
│           │   ├── errors.ts        # Typed error classes
│           │   ├── logger.ts        # Pino logger singleton
│           │   └── pagination.ts    # Pagination utilities
│           ├── middlewares/
│           │   ├── auth.ts          # JWT verification middleware
│           │   ├── errorHandler.ts  # Global error handler
│           │   ├── requireRole.ts   # RBAC middleware
│           │   └── validate.ts      # Zod request validation
│           └── routes/
│               ├── auth.ts          # /auth/register, /auth/login
│               ├── users.ts         # /users CRUD
│               ├── products.ts      # /products CRUD
│               └── orders.ts        # /orders CRUD
└── lib/
    └── db/
        └── src/schema/
            ├── users.ts
            ├── products.ts
            ├── orders.ts
            └── orderItems.ts
```

---

## Getting Started

### Prerequisites

- Node.js >= 20
- PostgreSQL database
- pnpm (`npm install -g pnpm`)

### Installation

```bash
# Clone the repository
git clone https://github.com/LAzzawi/E-commerce-API.git
cd E-commerce-API

# Install dependencies
pnpm install

# Set up environment variables (see below)
cp .env.example .env

# Push database schema
pnpm --filter @workspace/db run push

# Start the development server
pnpm --filter @workspace/api-server run dev
```

The API will be available at `http://localhost:8080/api`.

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `SESSION_SECRET` | Secret key for signing JWT tokens | ✅ |
| `PORT` | Server port (default: `8080`) | ❌ |
| `NODE_ENV` | Environment (`development` / `production`) | ❌ |

Example `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/ecommerce
SESSION_SECRET=your-super-secret-key-min-32-chars
PORT=8080
NODE_ENV=development
```

---

## Database Schema

```
users
  id           UUID  PK
  email        TEXT  UNIQUE NOT NULL
  password_hash TEXT NOT NULL
  name         TEXT  NOT NULL
  role         ENUM  (customer | admin)  DEFAULT customer
  created_at   TIMESTAMP
  updated_at   TIMESTAMP

products
  id           UUID  PK
  name         TEXT  NOT NULL
  description  TEXT
  price        NUMERIC(10,2)  NOT NULL
  stock        INTEGER  DEFAULT 0
  category     TEXT
  image_url    TEXT
  created_at   TIMESTAMP
  updated_at   TIMESTAMP

orders
  id           UUID  PK
  user_id      UUID  FK → users.id
  status       ENUM  (pending | processing | shipped | delivered | cancelled)
  total        NUMERIC(10,2)
  created_at   TIMESTAMP
  updated_at   TIMESTAMP

order_items
  id           UUID  PK
  order_id     UUID  FK → orders.id
  product_id   UUID  FK → products.id
  quantity     INTEGER
  price        NUMERIC(10,2)
  created_at   TIMESTAMP
```

---

## API Reference

All endpoints are prefixed with `/api`. Protected endpoints require an `Authorization: Bearer <token>` header.

### Authentication

#### Register

```http
POST /api/auth/register
```

**Body:**

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response `201`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "customer",
    "createdAt": "2026-05-02T18:09:49.300Z"
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123","name":"John Doe"}'
```

---

#### Login

```http
POST /api/auth/login
```

**Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response `200`:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "customer",
    "createdAt": "2026-05-02T18:09:49.300Z"
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

---

### Products

#### List Products

```http
GET /api/products
```

**Access:** Public

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: `1`) |
| `limit` | number | Items per page, max 100 (default: `20`) |
| `category` | string | Filter by category |
| `search` | string | Search by product name |

**Response `200`:**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Wireless Headphones",
      "description": "Premium noise-cancelling headphones",
      "price": "79.99",
      "stock": 48,
      "category": "electronics",
      "imageUrl": null,
      "createdAt": "2026-05-02T18:13:16.377Z",
      "updatedAt": "2026-05-02T18:13:16.377Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Example:**

```bash
curl "http://localhost:8080/api/products?page=1&limit=10&category=electronics"
```

---

#### Get Product

```http
GET /api/products/:id
```

**Access:** Public

**Example:**

```bash
curl "http://localhost:8080/api/products/550e8400-e29b-41d4-a716-446655440000"
```

---

#### Create Product

```http
POST /api/products
```

**Access:** Admin only 🔒

**Body:**

```json
{
  "name": "Wireless Headphones",
  "description": "Premium noise-cancelling headphones",
  "price": "79.99",
  "stock": 50,
  "category": "electronics",
  "imageUrl": "https://example.com/headphones.jpg"
}
```

**Example:**

```bash
curl -X POST http://localhost:8080/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Wireless Headphones","price":"79.99","stock":50,"category":"electronics"}'
```

---

#### Update Product

```http
PUT /api/products/:id
```

**Access:** Admin only 🔒

**Body:** Any subset of product fields.

**Example:**

```bash
curl -X PUT http://localhost:8080/api/products/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"price":"69.99","stock":100}'
```

---

#### Delete Product

```http
DELETE /api/products/:id
```

**Access:** Admin only 🔒

**Example:**

```bash
curl -X DELETE http://localhost:8080/api/products/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

---

### Users

#### List Users

```http
GET /api/users
```

**Access:** Admin only 🔒

**Query Parameters:** `page`, `limit`

**Example:**

```bash
curl "http://localhost:8080/api/users?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

---

#### Get User

```http
GET /api/users/:id
```

**Access:** Own profile or Admin 🔒

**Example:**

```bash
curl "http://localhost:8080/api/users/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

---

#### Update User

```http
PUT /api/users/:id
```

**Access:** Own profile or Admin 🔒

**Body:**

```json
{
  "name": "Jane Doe",
  "password": "newpassword123"
}
```

**Example:**

```bash
curl -X PUT http://localhost:8080/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Jane Doe"}'
```

---

#### Delete User

```http
DELETE /api/users/:id
```

**Access:** Admin only 🔒

**Example:**

```bash
curl -X DELETE http://localhost:8080/api/users/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

---

### Orders

#### Create Order

```http
POST /api/orders
```

**Access:** Authenticated 🔒

Automatically calculates total, validates stock availability, and decrements product stock on success.

**Body:**

```json
{
  "items": [
    { "productId": "550e8400-e29b-41d4-a716-446655440000", "quantity": 2 },
    { "productId": "660e8400-e29b-41d4-a716-446655440111", "quantity": 1 }
  ]
}
```

**Response `201`:**

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440222",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "total": "229.97",
  "createdAt": "2026-05-02T18:13:16.533Z",
  "updatedAt": "2026-05-02T18:13:16.533Z",
  "items": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440333",
      "orderId": "770e8400-e29b-41d4-a716-446655440222",
      "productId": "550e8400-e29b-41d4-a716-446655440000",
      "quantity": 2,
      "price": "79.99",
      "createdAt": "2026-05-02T18:13:16.533Z"
    }
  ]
}
```

**Example:**

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"items":[{"productId":"550e8400-e29b-41d4-a716-446655440000","quantity":2}]}'
```

---

#### List All Orders

```http
GET /api/orders
```

**Access:** Admin only 🔒

**Query Parameters:** `page`, `limit`

**Example:**

```bash
curl "http://localhost:8080/api/orders?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

---

#### List My Orders

```http
GET /api/orders/my
```

**Access:** Authenticated 🔒

**Query Parameters:** `page`, `limit`

**Example:**

```bash
curl "http://localhost:8080/api/orders/my" \
  -H "Authorization: Bearer <token>"
```

---

#### Get Order

```http
GET /api/orders/:id
```

**Access:** Own order or Admin 🔒

Returns full order details including line items.

**Example:**

```bash
curl "http://localhost:8080/api/orders/770e8400-e29b-41d4-a716-446655440222" \
  -H "Authorization: Bearer <token>"
```

---

#### Update Order Status

```http
PATCH /api/orders/:id/status
```

**Access:** Admin only 🔒

**Body:**

```json
{
  "status": "processing"
}
```

Valid statuses: `pending` → `processing` → `shipped` → `delivered` → `cancelled`

**Example:**

```bash
curl -X PATCH http://localhost:8080/api/orders/770e8400-e29b-41d4-a716-446655440222/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":"shipped"}'
```

---

#### Cancel Order

```http
DELETE /api/orders/:id
```

**Access:** Own pending order or Admin 🔒

Customers can only cancel orders with `pending` status. Admins can cancel any order.

**Example:**

```bash
curl -X DELETE http://localhost:8080/api/orders/770e8400-e29b-41d4-a716-446655440222 \
  -H "Authorization: Bearer <token>"
```

---

## Error Handling

All errors return a consistent JSON structure:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

Validation errors include a `details` array:

```json
{
  "error": "Validation error",
  "code": "VALIDATION_ERROR",
  "details": [
    { "path": "email", "message": "Invalid email address" },
    { "path": "password", "message": "Password must be at least 8 characters" }
  ]
}
```

| HTTP Status | Code | Description |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid request body / query params |
| 400 | `BAD_REQUEST` | Business logic error (e.g. insufficient stock) |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate resource (e.g. email already registered) |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## Pagination

All list endpoints support cursor-free offset pagination:

```
GET /api/products?page=2&limit=10
```

Response always includes a `pagination` object:

```json
{
  "data": [...],
  "pagination": {
    "total": 84,
    "page": 2,
    "limit": 10,
    "totalPages": 9
  }
}
```

| Param | Default | Max |
|---|---|---|
| `page` | `1` | — |
| `limit` | `20` | `100` |

---

## License

MIT
