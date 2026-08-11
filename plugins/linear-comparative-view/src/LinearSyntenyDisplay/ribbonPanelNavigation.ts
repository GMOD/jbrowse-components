import { assembleLocStringRaw } from '@jbrowse/core/util'

import type { FeatPos } from './model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface Span {
  start: number
  end: number
}

/**
 * Map a window on one axis of a drawn ribbon onto the other axis, by
 * interpolating across the block.
 *
 * INTERPOLATION RATHER THAN A CIGAR WALK, and it is not the lesser version of
 * one here: the main thread never receives per-row CIGAR strings for a synteny
 * band (`SyntenyFeatureData` carries the mate coordinates and a `hasCigar`
 * flag, and the ops themselves live in GPU geometry), so this is the geometry
 * the ribbon under the cursor is actually *drawn* with. Reading the mate
 * position off the straight edge is the answer the picture gives. The LGV
 * track item can do better because it holds the real `Feature`; see
 * `LGVSyntenyDisplay/matePanelNavigation.ts`, which walks the CIGAR when there
 * is one.
 *
 * SYMMETRIC IN THE TWO DIRECTIONS, which is what lets one function serve both
 * menu items: for a reverse-strand block the forward map is
 * `mate.end - t*mateLen`, and inverting that is algebraically the same
 * expression with the two spans swapped. So "move the lower panel" and "move
 * the upper panel" differ only in which pair goes in which argument.
 */
export function mapSpanAcrossBlock({
  source,
  target,
  strand,
  region,
}: {
  source: Span
  target: Span
  strand: number
  region: Span
}) {
  // clamped to the block first, so a window wider than the alignment (or
  // starting left of it) lands back on the block's own ends rather than
  // extrapolating off either side of the target
  const clamp = (x: number) => Math.min(Math.max(x, source.start), source.end)
  const lo = clamp(region.start)
  const hi = clamp(region.end)
  const sourceLen = source.end - source.start
  const targetLen = target.end - target.start
  // a zero-length block has no interior to interpolate across; both ends map
  // to the target's own start, which the caller widens to one base
  const offset = (x: number) =>
    sourceLen > 0 ? ((x - source.start) / sourceLen) * targetLen : 0
  const place = (x: number) =>
    strand === -1 ? target.end - offset(x) : target.start + offset(x)
  const a = place(lo)
  const b = place(hi)
  return {
    // a reverse-strand walk counts down, so the two ends arrive swapped
    start: Math.floor(Math.min(a, b)),
    end: Math.ceil(Math.max(a, b)),
  }
}

/**
 * The part of `view`'s visible window that lies on `refName`, or undefined
 * when the panel is not showing that contig at all — which is the case a
 * "move the other panel" item has nothing to say about, since there is no
 * window on this alignment's axis to map across.
 *
 * `dynamicBlocks` rather than the model's `coarseDynamicBlocks`: this is read
 * inside an onClick at the moment of the click, so the debounced copy would
 * answer with wherever the panel was up to a tick ago.
 */
export function visibleSpanOnRefName(
  view: LinearGenomeViewModel,
  refName: string,
): Span | undefined {
  const blocks = view.dynamicBlocks.contentBlocks.filter(
    b => b.refName === refName,
  )
  if (!blocks.length) {
    return undefined
  }
  return {
    start: Math.min(...blocks.map(b => b.start)),
    end: Math.max(...blocks.map(b => b.end)),
  }
}

/**
 * Where the panel opposite `sourceView` should be sent so that the ribbon the
 * user right-clicked runs vertically between the two: the slice of the other
 * axis that this alignment puts opposite the source panel's VISIBLE WINDOW.
 *
 * The visible window, not the feature's midpoint, is the whole difference from
 * "Center on feature". A published liftOver-style chain is one feature tens of
 * Mb long, so centering both panels on its midpoint moves them somewhere
 * neither of them was looking; and the span rather than a point means the
 * moved panel matches the source panel's SCALE too.
 */
export function ribbonMatePanelLocString({
  feat,
  sourceView,
  moveMate,
}: {
  feat: FeatPos
  sourceView: LinearGenomeViewModel
  // true when the panel being moved is the one on the mate axis (the lower
  // row), false when it is the one on the feature axis (the upper row)
  moveMate: boolean
}) {
  const featSpan = { start: feat.start, end: feat.end }
  const mateSpan = { start: feat.mate.start, end: feat.mate.end }
  const source = moveMate ? featSpan : mateSpan
  const target = moveMate ? mateSpan : featSpan
  const sourceRefName = moveMate ? feat.refName : feat.mate.refName
  const targetRefName = moveMate ? feat.mate.refName : feat.refName
  const region = visibleSpanOnRefName(sourceView, sourceRefName)
  if (!region) {
    return undefined
  }
  const span = mapSpanAcrossBlock({
    source,
    target,
    strand: feat.strand,
    region,
  })
  return assembleLocStringRaw({
    refName: targetRefName,
    start: span.start,
    // at least one base, since a zero-width span would assemble into an
    // inverted locstring
    end: Math.max(span.start + 1, span.end),
  })
}
