/**
 * A mouse event's position in the coordinate space of the element the handler
 * is bound to.
 *
 * Off `currentTarget`, so there is no ref to thread and no way to measure
 * against an element other than the one that received the event — which is the
 * mistake this replaces. Five display handlers spelled the same three lines out,
 * in three spellings, and each was one edit from measuring against a box the
 * pointer was not in.
 *
 * **Read it during the handler.** React clears `currentTarget` once the handler
 * returns, so a deferred read (an rAF, a promise) measures `null`.
 *
 * Two neighbours do a deliberately different thing, and neither is a candidate
 * for this:
 *
 * - `getRelativeX` measures against an element passed in, because a rubberband
 *   drag tracks the pointer across the whole document and the box it projects
 *   through is not whatever is under the cursor.
 * - A display whose canvas is a borderless leaf element (the pileup) reads
 *   `offsetX`/`offsetY` off the native event, which is already this and costs no
 *   layout read. That only holds while nothing is drawn inside the element, so
 *   it is a fact about that canvas rather than a style to copy.
 */
export function eventPoint(event: {
  clientX: number
  clientY: number
  currentTarget: Element
}) {
  const rect = event.currentTarget.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}
