## 2024-XX-XX - Backend missing indexes
**Learning:** SQLite queries filtering on `is_pending` or sorting on `position` might be slow when the `pdfs` table grows large, due to missing indexes.
**Action:** Add indexes on `is_pending` and `position` to the database schema.

## 2024-XX-XX - Missing memoization in PDFGrid
**Learning:** `PDFGrid` and `AdminGrid` map over large arrays of slots, and the `EmptySlot` or `DraggableCoverSheetCard` items might be re-rendering unnecessarily if not memoized.
**Action:** Add `React.memo` to `DraggableCoverSheetCard` and `EmptySlot` to prevent re-renders when parent states change.

## 2026-03-11 - N+1 Query in PDF Labels API
**Learning:** `backend/server.js` was sequentially running `SELECT * FROM labels` inside a `.forEach()` loop of `db.all` for every PDF fetched in the `/api/pdfs` endpoint. This meant fetching a board of 24 PDFs would execute 25 DB queries sequentially, creating a significant latency bottleneck for initial page loads and WebSocket broadcasts.
**Action:** Replaced the loop with a single bulk query using `IN (${placeholders})` and manual in-memory grouping. The entire payload is now fetched in exactly 2 DB queries regardless of board size.
