/** bytes of serialized rows a session snapshot is willing to carry */
export const ROW_SNAPSHOT_BUDGET = 1_000_000

/** rows sampled to bound the sheet's size before measuring it exactly */
const SAMPLE_SIZE = 20

/**
 * Whether a sheet's rows are too large to persist into the session snapshot.
 *
 * The exact answer is `JSON.stringify(rowSet).length`, and taking it that way
 * means serializing the whole sheet on every snapshot — which the session
 * autosaves. Worse, the cost lands where it is least useful: a huge sheet is
 * both the slowest to serialize and the one whose answer was never in doubt.
 * (A sheet loaded from a URI skips all of this, since the cached location
 * already means "omit the rows". What is left is exactly the local-file and
 * blob imports, which is the normal case on desktop.)
 *
 * So bound it first. Serialize a sample, take the *smallest* row as a floor on
 * bytes per row, and if even that floor times the row count clears the budget
 * then the sheet exceeds it and no exact measurement could say otherwise. Only
 * a sheet that might fit is measured exactly — and being wrong either way there
 * is expensive: too high drops rows the user cannot get back, since a sheet
 * with no cached URI has nothing to reload from, and too low overruns the
 * sessionStorage quota and loses the whole session. (sessionStorage, not
 * localStorage: the session snapshot is mirrored there on every edit, and it is
 * the one of the two stores that throws on a write rather than an async put.)
 */
export function rowsExceedSnapshotBudget(rowSet: unknown) {
  const rows = (rowSet as { rows?: unknown[] } | undefined)?.rows
  if (!rows?.length) {
    return false
  }
  let floor = Number.POSITIVE_INFINITY
  const stride = Math.max(1, Math.ceil(rows.length / SAMPLE_SIZE))
  for (let i = 0; i < rows.length; i += stride) {
    floor = Math.min(floor, JSON.stringify(rows[i]).length)
  }
  return (
    floor * rows.length > ROW_SNAPSHOT_BUDGET ||
    JSON.stringify(rowSet).length > ROW_SNAPSHOT_BUDGET
  )
}
