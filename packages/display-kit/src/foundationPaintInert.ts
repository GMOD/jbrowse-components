/**
 * What a display foundation exposes for `RenderLifecycleMixin`'s `paintInert`
 * hook. Named the same on both foundations, which is what lets one expression
 * serve them.
 */
export interface PaintInertFoundation {
  /** `FetchMixin`'s / `GlobalFetchMixin`'s: a fetch that failed */
  error: unknown
  /** the foundation's: no content block is on screen — see `viewportEmpty` */
  viewportEmpty: boolean
}

/**
 * `paintInert` for a display foundation: the two states in which a display that
 * *would* paint a canvas never gets to, so `painted` must answer *finished*
 * rather than *pending*.
 *
 * The third of the foundation mappings, beside `foundationSvgReady` and
 * `foundationDisplayPhase`, and it exists for the reason those do: the
 * expression was written out character-identically on both fetch families, so a
 * third inert state would have had to be remembered twice — and the consumer
 * that would have gone on waiting is `painted`, which lives outside the display
 * (`data-display-drawn`, `waitForDisplaysDone`) and fails by burning a timeout
 * in silence.
 *
 * Still a hook on `RenderLifecycleMixin` rather than a read of `error` there:
 * that package is a leaf, and the name would collide with `FetchMixin`'s
 * volatile. This is only the two families' shared *fill*, and a display outside
 * them still owes its own.
 */
export function foundationPaintInert(self: PaintInertFoundation): boolean {
  return !!self.error || self.viewportEmpty
}
