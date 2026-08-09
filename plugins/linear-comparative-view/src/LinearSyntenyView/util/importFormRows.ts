// A linear synteny view is N assembly rows with N-1 synteny pairs between
// adjacent rows: pair i spans rows i and i+1 (see synteny-core's syntenyPairs).
// Editing the rows moves the "configure this pair" arrow, which is a pair index,
// so it needs re-deriving. That arithmetic lives here, named, so the components
// can speak in rows and pairs instead of open-coding offsets.
//
// Only the arrow: which *selection* belongs to which pair after an edit is
// answered by matching assemblies, not by index arithmetic — see
// synteny-core's remapSelectionsToPairs.

/**
 * Where the "configure this pair" arrow lands after the rows are reversed. Pair
 * i spans rows i and i+1, so reversing the stack maps it to pair
 * (rowCount - 2 - i): the same two assemblies, counted from the other end.
 *
 * Auto-arrange has no such correspondence (it computes a whole new ordering) and
 * resets to the first pair. A reversal does have one, and discarding it bounces
 * the user off the pair they were part way through configuring.
 */
export function reversedPairIndex({
  rowCount,
  selectedPair,
}: {
  rowCount: number
  selectedPair: number
}) {
  return Math.max(rowCount - 2 - selectedPair, 0)
}

/**
 * Where the "configure this pair" arrow lands after an assembly row is removed.
 * It stays on the pair it was on, so a removal above shifts its index down, and
 * it clamps into the surviving range, which is one pair shorter. Total over all
 * inputs — a row count with no pairs left clamps to 0 rather than relying on the
 * caller's disabled-button guard.
 */
export function pairIndexAfterRowRemoval({
  rowCount,
  removedRow,
  selectedPair,
}: {
  rowCount: number
  removedRow: number
  selectedPair: number
}) {
  const shifted = removedRow < selectedPair ? selectedPair - 1 : selectedPair
  return Math.max(Math.min(shifted, rowCount - 3), 0)
}
