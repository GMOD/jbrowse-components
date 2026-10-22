/** bytes of serialized rows a session snapshot is willing to carry */
export const ROW_SNAPSHOT_BUDGET = 1_000_000

/** rows sampled to bound the sheet's size before measuring it exactly */
const SAMPLE_SIZE = 20

/**
 * Whether a sheet's rows are too large to persist into the session snapshot,
 * which autosaves to sessionStorage and throws on overrunning its quota.
 *
 * The smallest of a sample of rows bounds bytes per row from below, so a sheet
 * that clears the budget even at that rate skips serializing every row on
 * every snapshot. Only a sheet that might fit is measured exactly.
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
