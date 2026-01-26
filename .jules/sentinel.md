## 2024-05-22 - Broken Access Control & Missing CSP

**Vulnerability 1:** The `GET /api/pdfs` endpoint allowed unauthenticated users to access "pending" (hidden) jobs by simply appending `?includePending=true` to the query string.

**Learning 1:** Public endpoints that support optional administrative filters must validate authentication when those filters are engaged. The endpoint was designed to be dual-use (public board and admin dashboard) but lacked conditional authorization.

**Vulnerability 2:** The application explicitly disabled Content Security Policy (CSP), leaving it vulnerable to Cross-Site Scripting (XSS) and object injection attacks.

**Learning 2:** "Infecting" users via a web application is often achieved through XSS or malicious object embedding. A strong CSP (`object-src 'none'`, `script-src 'self'`) is a critical defense-in-depth measure against these vectors.

**Prevention:**
1. Implement strict input validation on query parameters and ensure privileged data access enforces authentication.
2. Enable and configure CSP headers (using `helmet` or similar) to restrict resource loading to trusted origins.
