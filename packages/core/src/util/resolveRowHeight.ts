/** `rows.step`'s word for dividing the track's height between the rows. */
export const FIT_ROWS = 'fit'

/** A `rows.step`: a px row height, or `FIT_ROWS`. */
export type RowStep = number | typeof FIT_ROWS

/**
 * Resolve a multi-row display's `rows.step` into the px height consumers
 * actually draw with and divide by: a px step as-is, `'fit'` the display's
 * `autoRowHeight`. The other half of the contract `applyRowResizeWheel` and
 * tree-sidebar's `TreeDrawingModel` both spell `effectiveRowHeight` — see
 * agent-docs/reference/ROW_HEIGHT_AND_FIT.md.
 *
 * Two rules, and they pull in opposite directions, which is why they live here
 * rather than being restated per display:
 *
 * - **A sub-pixel fit height is legitimate and must pass through.** A cohort
 *   with more rows than the display has pixels genuinely has a fractional row
 *   height, and flooring it makes the content taller than the height it was
 *   asked to fit inside — which re-grows the track and makes fit mode report a
 *   scroll it is documented never to have. (2000 species floored to 1px re-grew
 *   a MAF track to 2045px; the same regression hit the variant displays.) So
 *   `autoRowHeight` itself is never floored.
 * - **The resolved value must never be non-positive.** Consumers divide by it
 *   (`rowAtY`, the hit tests, the renderers), so a `0` propagates NaN/Infinity.
 *   A rows viewport can legitimately reach 0px — the variant matrix's
 *   connector-line zone can swallow the whole display height — so this is
 *   reachable, and it is the one place the floor belongs.
 *
 * Multi-wiggle is always-fit and has no step to resolve, so it computes its
 * `effectiveRowHeight` directly rather than calling this.
 */
export function resolveRowHeight(step: RowStep, autoRowHeight: number) {
  const height = step === FIT_ROWS ? autoRowHeight : step
  return height > 0 ? height : 1
}
