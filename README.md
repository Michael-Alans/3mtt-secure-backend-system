# 3MTT Secure Backend System

A production-hardened Express.js backend implementing a **layered defense-in-depth** security architecture. This project demonstrates how to protect a Node.js API against common web vulnerabilities using industry-standard middleware and practices.

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

**Mitigation:** Every route that accepts input (`POST /api/login`, `POST /api/register`) has a **Zod schema** applied as middleware *before* the controller. The schema enforces strict type checking (e.g., valid email format, minimum password length). Invalid requests are rejected with a `400` status and **field-level error details**, preventing any malformed data from reaching business logic.

### 7. Cross-Site Request Forgery (CSRF) → **CORS Configuration**

**Threat:** A malicious website makes requests to our API on behalf of an authenticated user, exploiting the browser's automatic cookie-sending behavior.

**Mitigation:** CORS is configured with an **explicit origin allowlist** read from the `ALLOWED_ORIGINS` environment variable (not a wildcard `*`). Only approved domains can make cross-origin requests. Allowed methods are restricted to `GET, POST, PUT, DELETE`, and allowed headers to `Content-Type` and `Authorization`.

### 8. Unauthorized Access → **Authentication (JWT) & RBAC**

**Threat:** Unauthenticated users access protected resources, or regular users escalate privileges to access admin-only functionality.

**Mitigation:**
- **Authentication middleware** checks for a valid `Bearer` token in the `Authorization` header, returning `401 Unauthorized` if missing or invalid.
- **RBAC middleware** (`authorizeAdmin`) checks the authenticated user's role, returning `403 Forbidden` if the user lacks admin privileges. This prevents both horizontal and vertical privilege escalation.

### 9. Secret Leakage → **Environment Variable Management**

**Threat:** API keys, database credentials, or JWT secrets are accidentally committed to version control or hardcoded in source files.

**Mitigation:**
- All secrets are loaded via `process.env` using `dotenv`.
- A **Zod schema** validates that all required environment variables (`JWT_SECRET`, `DB_URL`, `ALLOWED_ORIGINS`) are present and correctly formatted at startup. The application **throws a critical error and refuses to start** if any are missing.
- `.env` is in `.gitignore`; `.env.example` provides safe placeholder values.

---

## Acknowledged Limitations

> **These are known gaps that would need to be addressed before a production deployment:**

1. **No real JWT verification** — The current `authenticate` middleware uses hardcoded token strings for demonstration. In production, `jsonwebtoken.verify(token, env.JWT_SECRET)` should be used.
2. **No database encryption at rest** — The system does not currently implement database-level encryption (e.g., TDE or column-level encryption).
3. **No HTTPS enforcement at the application level** — HSTS headers are set, but the server itself does not terminate TLS. A reverse proxy (e.g., Nginx, Cloudflare) is assumed for TLS termination.
4. **No request logging or audit trail** — There is no centralized logging (e.g., Winston, Pino) for security events like failed logins or rate-limit triggers.
5. **No CSRF tokens** — CORS alone does not fully prevent CSRF for cookie-based authentication. A dedicated CSRF token library (e.g., `csurf`) would be needed if cookies are used for auth.

---

## Project Structure

```
├── src/
│   ├── app.js                 # Express application entry point
│   ├── config/
│   │   └── env.js             # Zod-validated environment configuration
│   └── middleware/
│       ├── auth.js            # Authentication (401) & RBAC (403) middleware
│       ├── security.js        # Helmet, CORS, Rate Limiting configuration
│       └── validate.js        # Zod validation middleware (400)
├── tests/
│   └── security.test.js       # Integration tests for 400, 401, 403, 429
├── .env.example               # Safe placeholder environment variables
├── .gitignore                 # Excludes node_modules, .env, .DS_Store
├── SECURITY.md                # Additional security documentation
├── README.md                  # This file
└── package.json               # Dependencies and scripts
```

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env

# Run the server
node src/app.js

# Run security tests
pnpm test

# Run a security audit
pnpm audit
```
