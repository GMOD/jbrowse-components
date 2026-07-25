// A linear synteny view is N assembly rows with N-1 synteny pairs between
// adjacent rows: pair i spans rows i and i+1 (see synteny-core's syntenyPairs).
// The import form indexes its per-pair track selections by pair, so every row
// edit implies some pair arithmetic. It lives here, named, so the components can
// speak in rows and pairs instead of open-coding offsets.

/**
 * How removing an assembly row rewrites the pair-indexed state: which pair
 * selection disappears with it, and where the "configure this pair" arrow ends
 * up. Total over all inputs — a row count with no pairs left clamps to 0 rather
 * than relying on the caller's disabled-button guard.
 */
export function planRowRemoval({
  rowCount,
  removedRow,
  selectedPair,
}: {
  rowCount: number
  removedRow: number
  selectedPair: number
}) {
  // Removing a row destroys the pair below it, except for the last row, whose
  // only pair is the one above it.
  const lastPair = rowCount - 2
  // The arrow stays on the same pair, so a removal above it shifts its index
  // down; then it clamps into the surviving range, which is one pair shorter.
  const shifted = removedRow < selectedPair ? selectedPair - 1 : selectedPair
  return {
    removedPair: Math.max(Math.min(removedRow, lastPair), 0),
    nextSelectedPair: Math.max(Math.min(shifted, lastPair - 1), 0),
  }
}
