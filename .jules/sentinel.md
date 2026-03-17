## 2025-03-13 - Missing Payload Limits and CSP
**Vulnerability:** Missing request payload size limits (`express.json()` and `express.urlencoded()`) and explicitly disabled Content Security Policy (CSP) in helmet configuration.
**Learning:** Default configurations might not have boundaries setup out of the box. CSP was intentionally disabled due to the variety of assets required, making it vulnerable to injection attacks.
**Prevention:** Always define explicit boundaries for body-parsers to prevent large payload Denial of Service (DoS). When disabling CSP, verify if it can be enabled with a relaxed rule set (`'unsafe-inline'` or `data:`) rather than being entirely disabled.
## 2025-03-13 - Bcrypt Length DoS Vulnerability
**Vulnerability:** The login endpoint `app.post('/api/auth/login')` passed the raw, user-provided `password` string directly to `bcrypt.compare` without enforcing any length limits.
**Learning:** Supplying extremely long strings (e.g., > 10MB) to bcrypt functions blocks the Node.js event loop due to the expensive computational cost, leading to a Denial of Service (DoS) for all users of the application.
**Prevention:** Always implement strict length validation on input strings before hashing or comparing them with bcrypt. Bcrypt naturally truncates inputs longer than 72 bytes, so setting a reasonable upper limit (e.g., 100 characters) mitigates this risk without impacting valid authentication attempts.
