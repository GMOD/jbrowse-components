/**
 * Minimal row-packing primitive for integer-indexed 1D layouts.
 *
 * `rows[y]` is a flat `[s1,e1,s2,e2,...]` sorted ascending by start, where
 * intervals within a row never overlap. `placeRect` finds the first row
 * with no collision (or appends a new row), inserts `[start, end+2]`,
 * and returns the row INDEX (0, 1, 2, ...).
 *
 * How this differs from `GranularRectLayout` in this same folder, and
 * why this exists as a separate primitive:
 *
 * - **Keys:** GranularRectLayout keys rectangles by string ID in a
 *   `Map<string, Rectangle<T>>`; `placeRect` has no ID and no rectangle
 *   object. Callers with numeric indices (e.g. BAM read indices) don't
 *   pay the cost of allocating string IDs, Rectangle objects, or the
 *   outer Map — they use a `Uint16Array` of row indices instead.
 *
 * - **Scaling / height:** GranularRectLayout has `pitchX`, `pitchY`,
 *   multi-row rectangle heights, `maxHeight` / `hardRowLimit`,
 *   compact/collapse display modes, and returns pixel `top` values.
 *   `placeRect` is unit-agnostic (bp or px), one-row-per-rect, no
 *   limits, and returns a row index.
 *
 * - **Ancillary features:** GranularRectLayout supports `discardRange`,
 *   `getByCoord` hit-testing, serialization, and an `allFilled` flag
 *   for very wide rects. `placeRect` does none of this — consumers
 *   that need hit-testing build a Flatbush separately, and layout is
 *   recomputed rather than incrementally maintained.
 *
 * - **State ownership:** GranularRectLayout is a class with internal
 *   state; its lifetime must be managed to avoid retaining
 *   `Rectangle<T>` objects. `placeRect` is a pure function operating
 *   on a caller-owned `number[][]` array, so memory lifetime matches
 *   the caller's scope — no leak vector.
 *
 * Use `placeRect` for tight per-call layouts over typed-array data
 * (alignments pileup and chain rendering). Use `GranularRectLayout`
 * when you need persistent layout state, hit-testing, pitch scaling,
 * or variable row heights (feature/gene tracks).
 *
 * Per-row complexity:
 *   - O(1) append when the row's last end ≤ new start (start-sorted
 *     input — the common case)
 *   - O(log M) collision + insertion-point lookup for wide rows via
 *     binary search on ends. Ends are monotone within a row because
 *     intervals are non-overlapping and sorted by start.
 *   - O(M) for the splice shift when inserting mid-row; only taken
 *     once per placement, and only when the fast-path misses.
 *
 * @param rows  mutable `number[][]` — each row is `[s1,e1,s2,e2,...]`
 * @param start rect start (any numeric unit — bp, px, etc.)
 * @param end   rect end (exclusive)
 * @returns     the row index the rect was placed in
 */
export function placeRect(rows: number[][], start: number, end: number) {
  const paddedEnd = end + 2
  let y = rows.length
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!
    const len = row.length

    // Fast path: entire row ends before new start → O(1) append.
    if (row[len - 1]! <= start) {
      row.push(start, paddedEnd)
      y = r
      break
    }

    // Find j = first index where interval end > start. Only intervals
    // at/after j can possibly collide with [start, paddedEnd).
    let j: number
    if (len < 32) {
      j = 0
      while (row[j + 1]! <= start) {
        j += 2
      }
    } else {
      let lo = 0
      let hi = len >>> 1
      while (lo < hi) {
        const mid = (lo + hi) >>> 1
        if (row[(mid << 1) + 1]! <= start) {
          lo = mid + 1
        } else {
          hi = mid
        }
      }
      j = lo << 1
    }

    // Only interval j can collide — if its start is past paddedEnd there
    // is a gap and we insert at j; otherwise we collide and try next row.
    if (row[j]! >= paddedEnd) {
      row.splice(j, 0, start, paddedEnd)
      y = r
      break
    }
  }
  if (y === rows.length) {
    rows.push([start, paddedEnd])
  }
  return y
}
