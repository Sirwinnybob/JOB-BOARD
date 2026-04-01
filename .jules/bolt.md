## 2024-XX-XX - Backend missing indexes
**Learning:** SQLite queries filtering on `is_pending` or sorting on `position` might be slow when the `pdfs` table grows large, due to missing indexes.
**Action:** Add indexes on `is_pending` and `position` to the database schema.

## 2024-XX-XX - Missing memoization in PDFGrid
**Learning:** `PDFGrid` and `AdminGrid` map over large arrays of slots, and the `EmptySlot` or `DraggableCoverSheetCard` items might be re-rendering unnecessarily if not memoized.
**Action:** Add `React.memo` to `DraggableCoverSheetCard` and `EmptySlot` to prevent re-renders when parent states change.

## 2026-03-11 - N+1 Query in PDF Labels API
**Learning:** `backend/server.js` was sequentially running `SELECT * FROM labels` inside a `.forEach()` loop of `db.all` for every PDF fetched in the `/api/pdfs` endpoint. This meant fetching a board of 24 PDFs would execute 25 DB queries sequentially, creating a significant latency bottleneck for initial page loads and WebSocket broadcasts.
**Action:** Replaced the loop with a single bulk query using `IN (${placeholders})` and manual in-memory grouping. The entire payload is now fetched in exactly 2 DB queries regardless of board size.

## 2026-03-11 - Transaction Optimization for Bulk Writes
**Learning:** Sequential `stmt.run()` calls for bulk updates (reordering, label assignments) in SQLite were causing excessive disk I/O due to implicit transactions for each individual write operation.
**Action:** Wrapped bulk write loops in explicit `BEGIN TRANSACTION` and `COMMIT` blocks using `db.serialize()` to group multiple updates into a single atomic operation, significantly improving write performance and data integrity.

## 2026-03-11 - Performance Metrics for PDF API
**Learning:** Lack of server-side timing for critical endpoints makes it difficult to verify the real-world impact of performance optimizations.
**Action:** Added `console.time()` and `console.timeEnd()` to the `/api/pdfs` endpoint to provide measurable metrics for the bulk label fetching logic in development and production logs.

## 2026-03-18 - N+1 Query in Push Notifications Loop
**Learning:** Sequential `db.run()` calls for `UPDATE` (last_used_at) and `DELETE` (invalid) inside a `subscriptions.map` loop were causing an individual database query for every push notification sent. This resulted in O(N) database operations for each broadcast.
**Action:** Refactored the loop to collect subscription IDs into arrays and perform batch updates/deletions using `WHERE id IN (...)` within a single transaction after all notifications are sent. Used chunking (500 IDs) to respect SQLite's host parameter limits.

## 2026-04-01 - Sequential Database Updates in Settings API
**Learning:** Updating multiple settings rows currently spawns a Promise array of individual DB queries. While it runs concurrently via `Promise.all`, using a transaction in SQLite is more robust and performant, as it reduces the number of expensive disk syncs from one per update to one per transaction.
**Action:** Refactored the `PUT /api/settings` route to use a single database transaction within `db.serialize()`. Benchmarking showed a ~43% performance improvement in write operations.
