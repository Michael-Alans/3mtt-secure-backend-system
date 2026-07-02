# 3MTT Secure Backend System

A production-hardened Express.js backend implementing a **layered defense-in-depth** security architecture. This project demonstrates how to protect a Node.js API against common web vulnerabilities using industry-standard middleware and practices, with full **JWT authentication**, **MongoDB persistence**, **Redis caching**, and **paginated APIs**.

---

## Architecture Overview

```
Client Request
    │
    ▼
┌──────────┐   ┌──────────┐   ┌────────────┐   ┌─────────────┐   ┌────────────┐
│  Helmet   │──▶│   CORS   │──▶│ Rate Limit │──▶│  Zod Valid. │──▶│ Auth (JWT) │
│ (Headers) │   │ (Origins)│   │ (Throttle) │   │  (Schemas)  │   │  (Verify)  │
└──────────┘   └──────────┘   └────────────┘   └─────────────┘   └────────────┘
                                                                        │
                                                                        ▼
                                                               ┌────────────────┐
                                                               │  Controllers   │
                                                               │ (Auth / Items) │
                                                               └────────────────┘
                                                                  │          │
                                                            ┌─────┘          └─────┐
                                                            ▼                      ▼
                                                     ┌───────────┐          ┌───────────┐
                                                     │  MongoDB   │          │   Redis   │
                                                     │ (Mongoose) │          │ (ioredis) │
                                                     └───────────┘          └───────────┘
```

---

## Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `PORT` | No | Server port (default: `3000`) | `3000` |
| `NODE_ENV` | No | Environment mode (default: `development`) | `production` |
| `JWT_SECRET` | **Yes** | Secret key for signing/verifying JWTs (min 10 chars) | `my_super_secret_key_123` |
| `MONGO_URI` | No | MongoDB connection string (default: `mongodb://localhost:27017/secure-backend`) | `mongodb://localhost:27017/mydb` |
| `REDIS_URL` | No | Redis connection string (default: `redis://localhost:6379`) | `redis://localhost:6379` |
| `ALLOWED_ORIGINS` | **Yes** | Comma-separated list of allowed CORS origins | `http://localhost:3000,https://myapp.com` |

---

## Threat Model

This section documents the specific threats this system mitigates, the tools chosen for each, and the reasoning behind those choices.

### 1. Cross-Site Scripting (XSS) & Code Injection → **Helmet (CSP)**

**Threat:** An attacker injects malicious JavaScript into the application, which then executes in the browsers of other users, stealing session tokens or sensitive data.

**Mitigation:** Helmet's `Content-Security-Policy` is configured with `defaultSrc: ["'self'"]`, restricting the browser to only load resources (scripts, styles, images) from our own origin. This blocks any externally injected script from executing. Additionally, `scriptSrc` and `styleSrc` are locked to `'self'` to prevent inline script injection.

### 2. Clickjacking → **Helmet (frameguard, frameAncestors)**

**Threat:** An attacker embeds our application inside a transparent iframe on a malicious page, tricking users into clicking buttons they cannot see (e.g., "Delete Account").

**Mitigation:** `frameguard: { action: 'deny' }` and `frameAncestors: ["'none'"]` in the CSP directives instruct browsers to refuse to render our pages inside any `<iframe>`, completely neutralizing clickjacking attacks.

### 3. Protocol Downgrade & Cookie Hijacking → **Helmet (HSTS)**

**Threat:** An attacker intercepts an HTTP request before it upgrades to HTTPS, capturing sensitive data or session cookies in transit (man-in-the-middle attack).

**Mitigation:** HTTP Strict Transport Security (`hsts`) is configured with a `maxAge` of 1 year, `includeSubDomains`, and `preload`. This forces browsers to only communicate over HTTPS, eliminating the window for protocol downgrade attacks.

### 4. Server Fingerprinting → **Helmet (hidePoweredBy)**

**Threat:** The default `X-Powered-By: Express` header reveals the server framework, allowing attackers to target known Express-specific vulnerabilities.

**Mitigation:** `hidePoweredBy: true` removes this header, making automated scanning and targeted attacks more difficult.

### 5. Brute-Force & Credential Stuffing → **express-rate-limit**

**Threat:** An attacker sends thousands of login requests with different password combinations to guess a user's credentials, or uses leaked credential lists from other breaches.

**Mitigation:** A **layered rate-limiting strategy** is implemented:
- **Global limiter** (100 req/15 min) on all `/api/` routes prevents general API abuse and basic DDoS.
- **Strict auth limiter** (5 req/15 min) on `/api/login` and `/api/register` aggressively throttles authentication endpoints, returning a `429` status with a custom JSON error message.

### 6. Injection & Malformed Input → **Zod Validation**

**Threat:** An attacker sends unexpected data types, excessively long strings, or SQL/NoSQL injection payloads through API request bodies.

**Mitigation:** Every route that accepts input (`POST /api/login`, `POST /api/register`, `POST /api/items`) has a **Zod schema** applied as middleware *before* the controller. The schema enforces strict type checking (e.g., valid email format, minimum password length). Invalid requests are rejected with a `400` status and **field-level error details**, preventing any malformed data from reaching business logic.

### 7. Cross-Site Request Forgery (CSRF) → **CORS Configuration**

**Threat:** A malicious website makes requests to our API on behalf of an authenticated user, exploiting the browser's automatic cookie-sending behavior.

**Mitigation:** CORS is configured with an **explicit origin allowlist** read from the `ALLOWED_ORIGINS` environment variable (not a wildcard `*`). Only approved domains can make cross-origin requests. Allowed methods are restricted to `GET, POST, PUT, DELETE`, and allowed headers to `Content-Type` and `Authorization`.

### 8. Unauthorized Access → **JWT Authentication & RBAC**

**Threat:** Unauthenticated users access protected resources, or regular users escalate privileges to access admin-only functionality.

**Mitigation:**
- **Registration** hashes passwords using `bcryptjs` with 12 salt rounds before storing in MongoDB.
- **Login** verifies credentials using `bcrypt.compare()` and issues a signed JWT via `jsonwebtoken.sign()`.
- **Authentication middleware** verifies the Bearer token using `jsonwebtoken.verify()` with the `JWT_SECRET`, attaching the decoded payload `{ id, role }` to `req.user`.
- **RBAC middleware** (`authorizeAdmin`) checks the authenticated user's role, returning `403 Forbidden` if the user lacks admin privileges.

### 9. Secret Leakage → **Environment Variable Management**

**Threat:** API keys, database credentials, or JWT secrets are accidentally committed to version control or hardcoded in source files.

**Mitigation:**
- All secrets are loaded via `process.env` using `dotenv`.
- A **Zod schema** validates that all required environment variables (`JWT_SECRET`, `MONGO_URI`, `REDIS_URL`, `ALLOWED_ORIGINS`) are present and correctly formatted at startup. The application **throws a critical error and refuses to start** if any are missing.
- `.env` is in `.gitignore`; `.env.example` provides safe placeholder values.

### 10. Stale Data & Performance → **Redis Caching**

**Threat:** Repeated database queries for frequently accessed data cause unnecessary load and latency.

**Mitigation:**
- **Read-through cache**: GET endpoints check Redis first; on miss, query MongoDB and store result with a 5-minute TTL.
- **Cache invalidation**: POST, PUT, and DELETE operations automatically delete all related cache keys to prevent stale data.
- **Consistent key strategy**: Cache keys follow the pattern `prefix:originalUrl` for deterministic lookups.

---

## Project Structure

```
├── src/
│   ├── server.js              # Boot file: connects DB/Redis, starts Express
│   ├── app.js                 # Express application (routes + middleware)
│   ├── config/
│   │   ├── env.js             # Zod-validated environment configuration
│   │   ├── db.js              # MongoDB/Mongoose connection
│   │   └── redis.js           # Redis/ioredis client
│   ├── controllers/
│   │   ├── authController.js  # Register (bcrypt) & Login (JWT) logic
│   │   └── itemController.js  # Paginated CRUD with Redis caching
│   ├── middleware/
│   │   ├── auth.js            # JWT verification (401) & RBAC (403)
│   │   ├── cache.js           # Redis read-through cache middleware
│   │   ├── security.js        # Helmet, CORS, Rate Limiting
│   │   └── validate.js        # Zod validation middleware (400)
│   └── models/
│       ├── User.js            # Mongoose schema with bcrypt pre-save hook
│       └── Item.js            # Mongoose schema with pagination indexes
├── tests/
│   └── security.test.js       # Integration tests (auth, CRUD, pagination, RBAC, rate limiting)
├── .env.example               # Safe placeholder environment variables
├── .gitignore                 # Excludes node_modules, .env, .DS_Store
├── SECURITY.md                # Additional security documentation
├── README.md                  # This file
└── package.json               # Dependencies and scripts
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+
- **MongoDB** (local or Atlas cloud instance)
- **Redis** (local or cloud instance)

### Setup

```bash
# Install dependencies
pnpm install

# Copy environment config and edit with your values
cp src/.env.example .env

# Start the server (connects to MongoDB and Redis)
pnpm start

# Run integration tests (uses in-memory MongoDB, no external services needed)
pnpm test

# Run a security audit
pnpm audit
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/register` | ❌ | Register a new user (bcrypt hashed) |
| `POST` | `/api/login` | ❌ | Login and receive a JWT |
| `GET` | `/api/items?page=1&limit=10` | ✅ | List items (paginated, cached) |
| `POST` | `/api/items` | ✅ | Create a new item |
| `DELETE` | `/api/items/:id` | ✅ | Delete an item |
| `GET` | `/api/admin` | ✅ Admin | Admin-only dashboard |
