import {
  LABEL_PADDING_PX,
  renderedTextWidth,
} from '../RenderFeatureDataRPC/constants.ts'

import type { FeatureLabelData } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LabelDecimation } from './layoutInputs.ts'

// How much horizontal room a feature's labels claim: the reserved width of each
// kind, which of them survive the decimation, and the neighbour whitespace a
// name may overhang into. All arithmetic over one feature's labels, with no
// notion of rows or packing — `components/labelPositioning.ts` mirrors the width
// half of it on the drawing side.

// Whether a feature keeps its name under the active decimation policy. `all`
// keeps every name; `fitWidth` keeps pinned/highlighted names always, plus any
// name whose width (times `roomFactor`) fits the whitespace its overhang can use
// — the feature box PLUS the gap to the neighbor on the overhang side. A name
// renders left-aligned to the box and overhangs rightward (leftward in a reversed
// region) into free space (see computeLabelPosition), and the packer reserves
// exactly that overhang, so keying on box width alone dropped names that plainly
// had room; keying on the available room drops a name only where it would
// genuinely collide. So an isolated feature keeps its name however narrow its box,
// while a name crammed against its neighbor still sheds — thinning names (and
// their reserved row height) precisely in the dense stretches that overflow.
//
// `roomFactor` is the fit solve's continuous knob, searched over
// [0, FIT_MAX_ROOM_FACTOR]. Note it is NOT bounded below by 1: a factor under 1
// keeps a name even where the neighbor gap is narrower than the name, which is
// safe because the overhang the packer reserves is always the FULL name width, so
// a kept-but-crowded name is pushed to a lower row rather than overlapped. That is
// what lets the solve spend leftover vertical space on labels instead of
// whitespace. Higher factors demand proportionally more room, so the set of kept
// names shrinks monotonically as the factor rises.
export function keepFeatureLabel(
  labelDecimation: LabelDecimation,
  availableRoomPx: number,
  nameWidthPx: number,
  pinned: boolean,
  roomFactor: number,
) {
  return (
    labelDecimation === 'all' ||
    pinned ||
    availableRoomPx >= nameWidthPx * roomFactor
  )
}

// The label's width as DRAWN at this mode's font size (baked widths are measured
// at the base size, see renderedTextWidth), plus LABEL_PADDING_PX so adjacent
// labels packed onto one row keep a small gap and small measureText
// underestimates don't cause visual overlap. The padding is a fixed gap, so it is
// added after the scale rather than scaled with the text. Keep 0 when there's no
// label so the collapse-to-row-0 path (anyLabelRenders) and empty-feature packing
// stay unaffected.
export function paddedLabelWidthPx(
  label: { textWidth: number } | undefined,
  labelFontPx: number,
) {
  // Font 0 is the `bare` rung's "spend nothing" sentinel (dropBelowLabelRows):
  // no text draws there, so no width — including the fixed padding — may be
  // reserved for it.
  return label && label.textWidth > 0 && labelFontPx > 0
    ? renderedTextWidth(label.textWidth, labelFontPx) + LABEL_PADDING_PX
    : 0
}

// One reserved width per label KIND, kept separate rather than collapsed to a
// single max because the packer asks three different questions of them (see
// keptOverhangWidthPx, anyLabelRenders, and the decimation's name-only test).
// Each is 0 when its kind is switched off or absent, so the numbers alone encode
// what renders.
export interface LabelWidths {
  name: number
  description: number
  subfeature: number
}

// The widths one floatingLabelsData entry contributes under the current label
// flags. Subfeature labels are deliberately un-gated: unlike names and
// descriptions they always draw when present (see resolveFeatureLabels), so their
// width is always reserved.
export function renderedLabelWidths(
  labelData: FeatureLabelData,
  showLabels: boolean,
  showDescriptions: boolean,
  labelFontPx: number,
): LabelWidths {
  return {
    // The name alone. The isoform badge shares this row (see
    // `createMoreIsoformsLabel`) but its text depends on the isoform count being
    // probed, so `trimPreparedRef` adds its width at that count rather than
    // baking one width in here.
    name: showLabels ? paddedLabelWidthPx(labelData.nameLabel, labelFontPx) : 0,
    description: showDescriptions
      ? paddedLabelWidthPx(labelData.descriptionLabel, labelFontPx)
      : 0,
    subfeature: paddedLabelWidthPx(labelData.subfeatureLabel, labelFontPx),
  }
}

// A feature can own several floatingLabelsData entries (its own plus its
// subfeatures', via parentFeatureId); it must reserve enough for the widest of
// each kind.
//
// Widest across every isoform, including the ones a trim then drops: this runs
// in the preparation, which is one per pack, while the trim is per probed
// count. So a trimmed gene holds room for a transcript name it no longer draws
// — conservative, and identically so in the probe and the commit.
export function widerLabelWidths(a: LabelWidths, b: LabelWidths): LabelWidths {
  return {
    name: Math.max(a.name, b.name),
    description: Math.max(a.description, b.description),
    subfeature: Math.max(a.subfeature, b.subfeature),
  }
}

// Whether anything at all draws for this feature. Gates the sub-pixel
// density-collapse path: a collapsed box reserves no horizontal room, so a
// labeled feature must stack instead of piling its label onto row 0.
export function anyLabelRenders(widths: LabelWidths) {
  return widths.name > 0 || widths.description > 0 || widths.subfeature > 0
}

// Horizontal room a feature's labels need beyond its box, given which of them
// survived the keep decision. A decimated name contributes nothing, so the packer
// stops holding space for a name that will not draw.
export function keptOverhangWidthPx(
  widths: LabelWidths,
  keepName: boolean,
  keepDescription: boolean,
) {
  return Math.max(
    keepName ? widths.name : 0,
    keepDescription ? widths.description : 0,
    widths.subfeature,
  )
}

// Index of the first element >= `x` in ascending `sorted`.
function lowerBound(sorted: number[], x: number) {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! < x) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

// Index of the first element > `x` in ascending `sorted`.
function upperBound(sorted: number[], x: number) {
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! > x) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }
  return lo
}

// The value following one occurrence of `x` in ascending `sorted` (x itself when
// another element shares it), or undefined at the top end.
function valueAfter(sorted: number[], x: number) {
  return sorted[lowerBound(sorted, x) + 1]
}

// The value preceding one occurrence of `x` in ascending `sorted` (x itself when
// another element shares it), or undefined at the bottom end.
function valueBefore(sorted: number[], x: number) {
  const idx = upperBound(sorted, x) - 2
  return idx >= 0 ? sorted[idx] : undefined
}

// Per-feature horizontal whitespace (px) a label may overhang into, on each
// side: rightward room is the distance from the feature's left edge to the next
// feature's left edge (its box plus the gap after it, matching the rightward
// overhang the packer reserves via layoutEndBp); leftward room mirrors it from
// the right edge for reversed regions. A feature with no neighbor on a side has
// open space there (Infinity); one sharing its edge with another feature has
// none (a pile on one bp thins under decimation rather than every member
// reading the gap to the far neighbor as its own). Only computed for the
// `fitWidth` decimation rung; the default `all` policy keeps every name and
// never asks.
export function labelOverhangRoomPx(
  features: Map<string, { startBp: number; endBp: number }>,
  bpPerPx: number,
) {
  const spans = [...features.values()]
  const starts = spans.map(f => f.startBp).sort((a, b) => a - b)
  const ends = spans.map(f => f.endBp).sort((a, b) => a - b)
  const rightRoom = new Map<string, number>()
  const leftRoom = new Map<string, number>()
  for (const [id, f] of features) {
    const nextStart = valueAfter(starts, f.startBp)
    const prevEnd = valueBefore(ends, f.endBp)
    rightRoom.set(
      id,
      nextStart === undefined ? Infinity : (nextStart - f.startBp) / bpPerPx,
    )
    leftRoom.set(
      id,
      prevEnd === undefined ? Infinity : (f.endBp - prevEnd) / bpPerPx,
    )
  }
  return { rightRoom, leftRoom }
}

// A feature's packing geometry that does NOT vary with `labelRoomFactor`: its bp
// extent, its body height, and which reversed/non-reversed sides it occupies (a
// reversed region's label extends toward lower bp, so the overhang must widen the
// start rather than the end). Read-only, because the whole point of separating it
// from PackedExtent is that the per-factor pass cannot write here — a mutation
// would silently leak one probe's label decisions into the next.
