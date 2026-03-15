## 2025-03-13 - Missing Payload Limits and CSP
**Vulnerability:** Missing request payload size limits (`express.json()` and `express.urlencoded()`) and explicitly disabled Content Security Policy (CSP) in helmet configuration.
**Learning:** Default configurations might not have boundaries setup out of the box. CSP was intentionally disabled due to the variety of assets required, making it vulnerable to injection attacks.
**Prevention:** Always define explicit boundaries for body-parsers to prevent large payload Denial of Service (DoS). When disabling CSP, verify if it can be enabled with a relaxed rule set (`'unsafe-inline'` or `data:`) rather than being entirely disabled.
## 2025-03-14 - WebSocket Missing Authorization
**Vulnerability:** Missing authorization checks on sensitive WebSocket events (`edit_lock_acquired` and `edit_lock_released`).
**Learning:** WebSockets maintain an open connection that lacks per-request HTTP headers (like Authorization: Bearer). While standard HTTP routes were protected with `authMiddleware`, WebSocket message handlers implicitly trusted any connected client.
**Prevention:** Always authenticate WebSocket connections upon establishment (e.g., via `device_register`) and strictly enforce authorization inside specific message handlers that perform privileged actions by checking the connection's authenticated session state (`ws.deviceSessionId`).
