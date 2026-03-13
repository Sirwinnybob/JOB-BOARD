## 2025-03-13 - Missing Payload Limits and CSP
**Vulnerability:** Missing request payload size limits (`express.json()` and `express.urlencoded()`) and explicitly disabled Content Security Policy (CSP) in helmet configuration.
**Learning:** Default configurations might not have boundaries setup out of the box. CSP was intentionally disabled due to the variety of assets required, making it vulnerable to injection attacks.
**Prevention:** Always define explicit boundaries for body-parsers to prevent large payload Denial of Service (DoS). When disabling CSP, verify if it can be enabled with a relaxed rule set (`'unsafe-inline'` or `data:`) rather than being entirely disabled.
