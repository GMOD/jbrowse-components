/**
 * What a display foundation exposes for `RenderLifecycleMixin`'s `paintInert`
 * hook. Both foundations use the same names, so one expression serves them.
 */
export interface PaintInertFoundation {
  /** `FetchMixin`'s: a fetch that failed */
  error: unknown
  /** `FetchMixin`'s: a standing user cancel, durable until Retry or a viewport change */
  fetchCanceled: boolean
  /** the foundation's: no content block is on screen — see `viewportEmpty` */
  viewportEmpty: boolean
  /** `RegionTooLargeMixin`'s: the banner replaces the canvas until force-load or a zoom */
  regionTooLarge: boolean
  /** `CoarseTierMixin`'s: a coarse tier draws on the canvas in the banner's place */
  drawsWhenTooLarge?: boolean
}

/**
 * `paintInert` for a display foundation: the states in which a display that
 * *would* paint a canvas never gets to, so `painted` answers *finished* rather
 * than *pending*. Nothing a capture does ends any of them, and a consumer
 * outside the display (`data-display-drawn`, a circular ring sampling the
 * display's strip) that went on waiting would burn its timeout in silence.
 */
export function foundationPaintInert(self: PaintInertFoundation): boolean {
  return (
    !!self.error ||
    self.fetchCanceled ||
    self.viewportEmpty ||
    (self.regionTooLarge && !self.drawsWhenTooLarge)
  )
}
