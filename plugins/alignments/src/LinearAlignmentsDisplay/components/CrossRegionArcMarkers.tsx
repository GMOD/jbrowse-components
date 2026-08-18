import type { CrossRegionArcShape } from '../../features/arcs/crossRegionOverlay.ts'

// The endpoint squares of the read-cloud connectors in one band, shared by the
// on-screen overlay and the SVG export the way `SashimiArcLabels` is — the two
// hosts differ only in the hover handlers on the paths, and a second pass drawn
// in one and forgotten in the other is exactly the drift that shape avoids.
//
// A pass of its own, after every path rather than beside each arc's own, which
// is `drawArcsToCtx`' order and `ARC_PASSES`': a connector is translucent
// (ARC_FLAT_ALPHA) and a square is opaque, so interleaved, a later bar veils the
// squares of every earlier arc it crosses. Document order is paint order, so
// "every line, then every square" is this list rendered after the paths.
//
// Empty on every arc but a read-cloud connector — a dome's endpoints sit on the
// band's anchor line and carry no marker (`packArcMarkers`).
//
// No hover of their own, which is the canvas band's arrangement rather than a
// gap: `ARC_MARKER_PX / 2 <= ARC_HIT_SLOP_PX`, so a square is inside the
// tolerance of the bar it sits on, and the overlay's target path is stroked at
// exactly that tolerance (`hitStrokeWidth`). The squares inherit the host
// `<svg>`'s `pointerEvents: 'none'` and are answered for by the bar, in both
// renderers, by the same arithmetic.
export default function CrossRegionArcMarkers({
  arcs,
}: {
  arcs: CrossRegionArcShape[]
}) {
  return arcs.flatMap(
    arc =>
      arc.markers?.map((marker, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- packArcMarkers emits a fixed positional set per arc, never reordered
        <rect key={`${arc.key}-${i}`} {...marker} />
      )) ?? [],
  )
}
