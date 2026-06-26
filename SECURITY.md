# Security Threat Model & Protections

| Threat Profile | Mitigation Control | Implementation Details |
| :--- | :--- | :--- |
| **Brute Force / DoS** | Rate Limiting | Global limit of 100 req/15m; Strict `5 req/15m` wrapper over `/login` endpoints. |
| **XSS / Clickjacking** | Helmet.js Config | Frameguard set to `deny`, explicit CSP scripts boundary set to `'self'`. |
| **Cross-Origin Data Leaks** | Stripped CORS Wildcards | Explicit string parsing checks against the `ALLOWED_ORIGINS` matrix. |
| **SQLi / Injection Vectors** | Strict Schema Validation | Zod middleware parses structures before execution context handling. |