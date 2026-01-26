## 2024-05-22 - Broken Access Control in Public API

**Vulnerability:** The `GET /api/pdfs` endpoint allowed unauthenticated users to access "pending" (hidden) jobs by simply appending `?includePending=true` to the query string.

**Learning:** Public endpoints that support optional administrative filters must validate authentication when those filters are engaged. The endpoint was designed to be dual-use (public board and admin dashboard) but lacked conditional authorization.

**Prevention:** Implement strict input validation on query parameters and ensure that any parameter triggering privileged data access enforces an authentication check. Consider splitting public and private endpoints if logic becomes complex.
