// What one arc DRAWS, on screen. THE derivation — the Canvas2D/SVG stroke, the
// hover highlight's path, the hit test and the debug overlay all take their
// geometry from here.
//
// They used to each compute it. Three copies of four lines is cheap to write and
// the drift is silent, because every copy looks right on its own and the two
// that disagree are in different files: `98dd82120b` split the dome's Y from the
// flat mark's and updated two of the three, leaving the highlight tracing a
// curve the renderer had stopped drawing — visible only on wide pairs, which is
// exactly the case the split was about. The hit test had the same divergence
// against the paint one commit earlier, over the far/near width. Two instances
// of one shape is a missing function, not two bugs.
//
// This answers the SHAPE question too, and that is the other half of the same
// argument. Placing an arc used to be shared while resolving what it draws was
// not: each consumer took the placement and then asked `arcRadiiPx` (four sites)
// or widened the bar to `ARC_FLAT_MIN_PX` (three) and branched on `isFlat`
// itself. A mark is a bar or a dome, the numbers that describe each are
// different, and deciding which — once — is what stops a consumer measuring an
// ellipse against a circle the renderer painted.
import { arcRadiiPx } from '../../shaders/slang/arc.js.generated.ts'
import { ARC_FLAT_MIN_PX } from '../../shaders/slang/arcFlat.consts.generated.ts'
import { arcAnchorY, arcAvailH, arcMarkY, arcYOffsetPx } from './arcYScale.ts'
import { isFlatArcShape } from './shapes.ts'

import type { ArcsUploadData } from './types.ts'

// The band frame an arc is marked into. A subset of `ArcHitOptions` by
// construction — the hover passes that straight in — and the fields the Canvas2D
// draw already had in hand.
export interface ArcBandFrame {
  bpToScreenX: (bp: number) => number
  arcsYDomainBp: number
  arcsYLog: boolean
  arcsTop: number
  arcsH: number
  pairedArcsDown: boolean
  // The BLOCK's clamped on-screen width, which is the shader's `canvasW` — both
  // renderers upload `scissorW` there. It decides the near/far branch below, so
  // handing the whole track's width instead puts a consumer on a different side
  // of that test from the paint: an ellipse measured against a painted circle,
  // which is a different mark rather than a near miss.
  screenWidthPx: number
}

interface ArcMarkBase {
  // Midpoint of the two mates on screen. Both mark kinds are centred on it: the
  // bar is widened about it and the dome's conic is centred on it.
  mid: number
  // How far `yBp` plots from the anchor, on the drawn side, always positive. The
  // frame the hit test measures in, where "up" and "down" are one case, and the
  // height the dome's radii are derived from.
  //
  // CLAMPED into the band. A dome briefly took an unclamped Y (98dd82120b,
  // reverted): that let a wide pair's apex fall below the band, so it drew as two
  // clipped flanks with no arc between its endpoints. Mirrors arc.slang, off the
  // generated helper it is generated from.
  destY: number
}

// The read cloud's flat connector: a horizontal segment with a square at each
// mate.
export interface ArcBar extends ArcMarkBase {
  kind: 'bar'
  // Screen x of each mate, in the order the worker resolved them. NOT ordered: a
  // reversed region maps the pair onto the other side of the block, so `sx2` is
  // left of `sx1` there. Here for the endpoint squares, which sit on the real
  // mates however far the bar below was widened past them.
  sx1: number
  sx2: number
  // Half the DRAWN length — the pair's own half-span, widened to
  // ARC_FLAT_MIN_PX so a sub-pixel pair still paints something. THE extent: the
  // Canvas2D/SVG stroke, the highlight's path and the hit target all measure it,
  // and each spelled `Math.max(Math.abs(sx2 - sx1), ARC_FLAT_MIN_PX) / 2` for
  // itself, two of the three under a comment promising they mirrored the third.
  halfPx: number
  // Screen y of the bar and of the two squares on it. Bar-only, because it is
  // meaningless for a dome and was read as one anyway: it was called `apexY` and
  // documented as the dome's apex too, which is not true of any dome the
  // renderers draw — a curve peaks at `ARC_APEX_FRACTION` of `destY` (see
  // `arcRadiiPx`), and the only dome caller it ever had took it apart again to
  // recover `destY`.
  markY: number
}

// The breakend feet a dome can carry: a short horizontal tick at each foot,
// lying over the ARM that foot's junction keeps. Outward feet are a
// deletion-type junction, inward a duplication-type, parallel an inversion —
// the standard breakend grammar, and the only channel left saying it once
// `ARC_COLOR_INTERCHROM` has overwritten an interchromosomal arc's colour.
//
// "The arm", not "this segment's aligned body". The two coincide only where the
// arc's endpoint IS the junction, which is the split-read producer and not the
// mate-pair one — `pairOuterDir` (features/arcs/arcChains.ts) is where that gets
// reconciled, and it is what stops one junction drawing opposite feet depending
// on which kind of read happened to evidence it.
//
// LEFT/RIGHT rather than 1/2, because that is the question the path builder
// asks: the dome's two feet are `mid - rx` and `mid + rx`, which are min and max
// of the two projected xs. `arcMarkFrom` does the one comparison that resolves
// it, so no consumer has to re-decide which endpoint is on which side of a
// reversed region.
//
// The DIRECTION IS ALREADY SCREEN-SPACE. An arm direction is genomic, and a
// reversed displayed region (which is also how `horizontallyFlip` is
// implemented) mirrors it; the caller applies that, because it is the caller
// that knows which region each foot resolved through.
//
// Related, and the sign is opposite on purpose: `tangentSign`
// (core/util/bezierConnector.ts) is the direction a per-read connector LEAVES
// the same endpoint in, which is the reading direction — away from the body. A
// foot lies over the body and the curve departs across the junction, so the two
// together read as one mark, the way BreakpointSplitView's `buildBreakpointPath`
// draws a tick into its breakend and a line out of it. Don't "fix" either to
// match the other.
export interface ArcFeet {
  leftDir: number
  rightDir: number
  // How far each tick reaches, in CSS px: `ARC_FOOT_PX`, or less where the
  // foot's own displayed region ends sooner. A foot lies over sequence the
  // junction keeps, so it stops at the seam rather than crossing onto a contig
  // the junction says nothing about. Zero draws nothing.
  leftLen: number
  rightLen: number
  // How far inside the band the ticks are drawn, as an offset from the anchor —
  // unresolved for the reason `destY` is: the mark is band-local and
  // `offsetArcMark` moves the anchor, so a foot stored as an absolute y would
  // need moving too. The caller sets it from the stroke width, since a tick
  // drawn exactly ON the anchor loses its outer half to the band's clip.
  insetPx: number
}

// The paired-read dome: a half conic from foot to foot over the anchor line.
export interface ArcDome extends ArcMarkBase {
  kind: 'dome'
  // The band edge the arc springs from — insert size 0. Bottom of the band when
  // arcs point up, top when they point down. The conic's centre y.
  anchorY: number
  rx: number
  ry: number
  // Which way it bulges, so a stroker and a path builder each take a mark and
  // nothing else — the sweep is the only thing the band's direction changes.
  down: boolean
  // Whether the two radii are equal, i.e. whether this dome is a true CIRCLE —
  // read off the radii rather than by re-asking `arcIsFar`, which the generated
  // module deliberately does not export so that a consumer cannot ask it
  // separately from the radii it decides.
  //
  // It is NOT "did `arcRadiiPx` take the far branch", and it was named `far` as
  // though it were. The far branch returns equal radii, but so does the near one
  // whenever a pair's on-screen half-span happens to equal `0.75 * destY` — and
  // `destY` clamps to `availH` for every arc at or above the domain, which pins
  // `ry` to one value across a large share of a feed and makes the coincidence
  // ordinary rather than freakish.
  //
  // Circle-ness is the right question for both readers anyway, which is why the
  // rename costs nothing. `hitTest.ts` wants it because `distToWideCirclePx` is
  // the circle formula, assembled from small terms so a radius in the millions
  // does not cancel away every significant digit the ellipse solver has. The
  // debug overlay wants it because a circle is what got PAINTED; which branch
  // produced it is not observable in the picture, so reporting the branch was
  // reporting something the reader cannot check against the ink.
  circular: boolean
  // Absent on every arc a per-region pass draws: `arcMark` reads
  // `ArcsUploadData`, which carries no per-foot direction, and adding one would
  // mean the GPU and Canvas2D passes growing the mark too. Present only on the
  // cross-region overlay's interchromosomal arcs — the family that is ALWAYS
  // cross-region, so no arc gains or loses feet by being panned.
  feet?: ArcFeet
}

// A bar or a dome. Every consumer switches on `kind` and is then handed exactly
// the numbers that kind is described by — there is no field on either that
// belongs to the other shape.
export type ArcMark = ArcBar | ArcDome

// One arc, already projected. The bp→x step is the caller's because the two
// callers resolve it differently and cannot share a `(bp) => x`: a per-region
// pass maps both feet through the block it is drawing, while the cross-region
// overlay resolves each foot through ITS OWN displayed region — which is the
// whole difference between the two and the reason `CrossRegionArc` exists.
//
// Everything below this point is identical for both, which is the point of
// splitting it out: the overlay's arc is the same shape the GPU would have
// drawn, not a second approximation of it.
export interface ProjectedArc {
  sx1: number
  sx2: number
  yBp: number
  shapeType: number
  // Breakend feet, in sx1/sx2 order and already in screen direction — see
  // `ArcFeet`, which is what this resolves into. Omitted by the per-region
  // `arcMark` path, which has no per-foot direction to give.
  feet?: {
    dir1: number
    dir2: number
    len1: number
    len2: number
    insetPx: number
  }
}

export function arcMark(
  data: ArcsUploadData,
  i: number,
  frame: ArcBandFrame,
): ArcMark {
  return arcMarkFrom(
    {
      sx1: frame.bpToScreenX(data.arcX1[i]!),
      sx2: frame.bpToScreenX(data.arcX2[i]!),
      yBp: data.arcYBp[i]!,
      shapeType: data.arcShapeTypes[i]!,
    },
    frame,
  )
}

export function arcMarkFrom(
  { sx1, sx2, yBp, shapeType, feet }: ProjectedArc,
  frame: Omit<ArcBandFrame, 'bpToScreenX'>,
): ArcMark {
  const {
    arcsYDomainBp,
    arcsYLog,
    arcsTop,
    arcsH,
    pairedArcsDown,
    screenWidthPx,
  } = frame
  const mid = (sx1 + sx2) / 2
  const anchorY = arcAnchorY(arcsTop, arcsH, pairedArcsDown)
  const destY = arcYOffsetPx(yBp, arcsYDomainBp, arcsYLog, arcAvailH(arcsH))
  // One Y rule for both kinds — the split above is the shape, not the height.
  if (isFlatArcShape(shapeType)) {
    // No feet on a bar, and no caller passes any: a flat connector already marks
    // its two real mates with endpoint squares, and the read cloud is the only
    // mode that draws one — the mode interchromosomal arcs are excluded from
    // outright (see `resolveArcs`, `INTERCHROM_ARC_YBP`).
    return {
      kind: 'bar',
      mid,
      destY,
      sx1,
      sx2,
      halfPx: Math.max(Math.abs(sx2 - sx1), ARC_FLAT_MIN_PX) / 2,
      markY: arcMarkY(anchorY, destY, pairedArcsDown),
    }
  }
  const [rx, ry] = arcRadiiPx(Math.abs(sx2 - sx1) / 2, destY, screenWidthPx)
  return {
    kind: 'dome',
    mid,
    destY,
    anchorY,
    rx,
    ry,
    down: pairedArcsDown,
    circular: rx === ry,
    // THE one place the two endpoints are sorted onto the two sides of the mark.
    // `mid - rx` is min(sx1, sx2) and `mid + rx` is max, whichever branch above
    // set the radii — so a reversed region, which puts sx2 left of sx1, is
    // handled here rather than by every consumer.
    feet:
      feet === undefined
        ? undefined
        : {
            leftDir: sx1 <= sx2 ? feet.dir1 : feet.dir2,
            rightDir: sx1 <= sx2 ? feet.dir2 : feet.dir1,
            leftLen: sx1 <= sx2 ? feet.len1 : feet.len2,
            rightLen: sx1 <= sx2 ? feet.len2 : feet.len1,
            insetPx: feet.insetPx,
          },
  }
}

// The same mark, moved down the screen by `dy`. Exactly one y per kind moves —
// the bar's `markY`, the dome's `anchorY` — and `destY` is an offset from that
// anchor rather than a position, so it must not.
//
// It exists because the cross-region overlay draws BAND-LOCAL (its `<svg>` is
// positioned at the band, which is what lets `overflow: hidden` be the clip)
// while `ArcHoverOverlay` draws at the component's origin. Re-tracing the arc
// there from a second projection is what this avoids: the highlight has to lie
// on the arc it is highlighting, which is the whole reason `arcMark` is one
// derivation.
export function offsetArcMark(mark: ArcMark, dy: number): ArcMark {
  return mark.kind === 'bar'
    ? { ...mark, markY: mark.markY + dy }
    : { ...mark, anchorY: mark.anchorY + dy }
}
