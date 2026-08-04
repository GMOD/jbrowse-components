/**
 * Resolve a multi-row display's raw `rowHeight` setting, where `0` is the
 * fit-to-display-height sentinel, into the px height consumers actually draw
 * with and divide by. The other half of the contract `applyRowResizeWheel` and
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
 * Multi-wiggle is always-fit and has no sentinel to resolve, so it computes its
 * `effectiveRowHeight` directly rather than calling this.
 */
export function resolveRowHeight(rowHeight: number, autoRowHeight: number) {
  const height = rowHeight === 0 ? autoRowHeight : rowHeight
  return height > 0 ? height : 1
}
