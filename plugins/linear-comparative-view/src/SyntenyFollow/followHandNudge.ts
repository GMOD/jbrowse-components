import type { FollowWindow } from './followAnchorWindow.ts'

/**
 * What one level's two rows were showing when a pass looked at them, as two
 * strings a later pass can compare its own against.
 *
 * A string rather than the windows themselves because `followAnchorWindows`
 * builds fresh objects every pass off block coordinates that do not change —
 * `setCoarseDynamicBlocks` compares block keys and declines to reassign an
 * equivalent array, so the numbers are stable across a pass that moved nothing
 * and identity is not.
 */
export interface FollowRowWindows {
  input: string
  moving: string
}

export function followWindowSignature(windows: FollowWindow[]) {
  return windows.map(w => `${w.refName}:${w.start}-${w.end}`).join(',')
}

/**
 * Whether the moving row's disagreement with the follow is the USER's doing.
 *
 * The follow re-asserts itself over a row someone has moved by hand — that is
 * what the exact pass's read of the moving row is for — and from inside the
 * pass that re-assertion looks exactly like an ordinary placement. It is not,
 * to the person watching: they zoomed a row out and it came straight back, with
 * nothing on screen saying why. So the two have to be told apart before either
 * can be reported.
 *
 * ONE IDEA IN THREE CLAUSES: this row moved, and nothing here moved it.
 *
 * - `previous` absent is the first pass over this level, which has no claim to
 *   make about who moved what.
 * - `placedByFollow` is the pass BEFORE this one having positioned or navigated
 *   the row, or a navigation still outstanding (`lastNav`). Both leave the row
 *   somewhere other than where the last snapshot recorded it, and the follow
 *   putting a row where it decided the row goes is not the user nudging it.
 * - The input row holding is what separates the two. A moved input makes this
 *   placement an ordinary consequence of the anchor moving, however far the row
 *   travels; an input that did not move leaves the row's own motion as the only
 *   thing that changed.
 *
 * The input row is the LEVEL's, not the anchor: an interior row is placed from
 * the row above it, and that is the row whose motion explains its own.
 */
export function handNudged({
  now,
  previous,
  placedByFollow,
}: {
  now: FollowRowWindows
  previous: FollowRowWindows | undefined
  placedByFollow: boolean
}) {
  return (
    previous !== undefined &&
    !placedByFollow &&
    now.input === previous.input &&
    now.moving !== previous.moving
  )
}

/**
 * What the reader is told, in the two names they can see on screen.
 *
 * It reports the snap rather than forbidding the move, because the move is not
 * forbidden — the two actions offered beside it are both ways to keep it, and
 * naming the anchor is what makes the second one make sense. Which row drives
 * is otherwise visible only inside a submenu, and a stack can hold one assembly
 * twice, which is why both names come from `rowLabels` rather than from the
 * assembly name alone.
 */
export function handNudgeMessage(movingLabel: string, anchorLabel: string) {
  return `${movingLabel} is following ${anchorLabel}, so it moved back to the matching region`
}
