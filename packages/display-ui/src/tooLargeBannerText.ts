// What the byte gate says, and the only part of that gate that belongs to the
// UI. The measurement side — byte estimates, the sub-floor budget factor,
// `resolveByteLimit` — stays in `RegionTooLargeMixin`'s own module, which
// re-exports this so a display keeps one import.
//
// It is here because *both* overlay sets render it: JBrowse's Material
// `TooLargeMessage` and the toolkit-free `PlainTooLarge`, plus anyone writing a
// third. Wording that drifts between them is a difference nobody would see in
// review and the screenshot harness keys off the literal.

/**
 * Which axis tripped (empty when the display gates without a reason), then the
 * way out.
 *
 * `zoomCanRelease` decides whether "zoom in" is offered, and it has to be asked
 * because the advice is not always true. It was, once: the `AUTO_FORCE_LOAD_BP`
 * floor turned the byte gate off below 20kb, so zooming far enough always
 * worked. The byte gate no longer stops at any floor, and an index quotes whole
 * blocks — so for a file whose blocks are large the same bytes come down however
 * far the user goes, and telling them to keep zooming into a fetch whose cost
 * cannot fall is the one thing the banner must not do. `zoomCanReleaseGate`
 * answers it from two consecutive measurements rather than from a threshold; see
 * `ByteEstimate.zoomIneffective`.
 */
export function tooLargeBannerText(
  regionTooLargeReason: string,
  { zoomCanRelease = true }: { zoomCanRelease?: boolean } = {},
) {
  return [
    regionTooLargeReason,
    zoomCanRelease
      ? 'Zoom in to see features, or force load this track for the rest of the session (may be slow)'
      : 'Force load this track for the rest of the session (may be slow)',
  ]
    .filter(f => !!f)
    .join('. ')
}
