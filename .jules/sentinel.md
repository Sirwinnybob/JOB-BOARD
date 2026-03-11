## 2024-05-22 - Broken Access Control in Public API

**Vulnerability:** The `GET /api/pdfs` endpoint allowed unauthenticated users to access "pending" (hidden) jobs by simply appending `?includePending=true` to the query string.

**Learning:** Public endpoints that support optional administrative filters must validate authentication when those filters are engaged. The endpoint was designed to be dual-use (public board and admin dashboard) but lacked conditional authorization.

**Prevention:** Implement strict input validation on query parameters and ensure that any parameter triggering privileged data access enforces an authentication check. Consider splitting public and private endpoints if logic becomes complex.

## 2024-05-23 - Command Injection Risk in External Tool Calls

**Vulnerability:** The application was using `child_process.exec` to execute external shell tools (`pdftocairo`, `magick`, `pdfinfo`, `tesseract`, and `python3`) by passing commands as interpolated strings. While the variables being interpolated were somewhat constrained, an unexpected input variation could allow arbitrary shell execution (Command Injection).

**Learning:** Any dynamic values embedded in shell commands using `exec` introduce serious command injection risks. Even when values appear "safe" (like randomly generated identifiers), this approach breaks defense-in-depth principles. Furthermore, piping output inside the shell string (like `pdfinfo ... | grep ... | awk ...`) introduces complexity and increases the vulnerability surface.

**Prevention:** Always use `child_process.execFile` or `child_process.spawn` instead of `exec`, passing arguments as an array rather than a single string, which avoids invoking a shell entirely. Extract data programmatically (e.g. using RegEx on stdout) instead of piping through shell utilities.
