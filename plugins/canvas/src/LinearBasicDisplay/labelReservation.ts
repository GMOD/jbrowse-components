import {
  LABEL_PADDING_PX,
  renderedTextWidth,
} from '../RenderFeatureDataRPC/constants.ts'

import type { FeatureLabelData } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LabelDecimation } from './layoutInputs.ts'

// Keyed on the room the overhang can use (box plus the gap to the neighbour),
// not box width alone, so an isolated feature keeps its name however narrow.
// `roomFactor` is not bounded below by 1: the packer always reserves the full
// name width, so a kept-but-crowded name drops a row rather than overlapping.
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

// The padding is a fixed gap, added after the scale rather than scaled with
// the text.
export function paddedLabelWidthPx(
  label: { textWidth: number } | undefined,
  labelFontPx: number,
) {
  // Font 0 is the `bare` rung's sentinel: no text draws, so no width, padding
  // included, may be reserved.
  return label && label.textWidth > 0 && labelFontPx > 0
    ? renderedTextWidth(label.textWidth, labelFontPx) + LABEL_PADDING_PX
    : 0
}

export interface LabelWidths {
  name: number
  description: number
  subfeature: number
}

// Subfeature labels are un-gated: they always draw when present, so their
// width is always reserved.
export function renderedLabelWidths(
  labelData: FeatureLabelData,
  showLabels: boolean,
  showDescriptions: boolean,
  labelFontPx: number,
): LabelWidths {
  return {
    // The isoform badge shares this row but depends on the count being
    // probed, so `trimPreparedRef` adds its width per count.
    name: showLabels ? paddedLabelWidthPx(labelData.nameLabel, labelFontPx) : 0,
    description: showDescriptions
      ? paddedLabelWidthPx(labelData.descriptionLabel, labelFontPx)
      : 0,
    subfeature: paddedLabelWidthPx(labelData.subfeatureLabel, labelFontPx),
  }
}

// Widest across every isoform, including ones a trim then drops: preparation
// runs once per pack and the trim once per count, so the probe and the commit
// are conservative identically.
export function widerLabelWidths(a: LabelWidths, b: LabelWidths): LabelWidths {
  return {
    name: Math.max(a.name, b.name),
    description: Math.max(a.description, b.description),
    subfeature: Math.max(a.subfeature, b.subfeature),
  }
}

// A collapsed box reserves no horizontal room, so a labeled feature must
// stack instead of piling onto row 0.
export function anyLabelRenders(widths: LabelWidths) {
  return widths.name > 0 || widths.description > 0 || widths.subfeature > 0
}

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

function valueAfter(sorted: number[], x: number) {
  return sorted[lowerBound(sorted, x) + 1]
}

function valueBefore(sorted: number[], x: number) {
  const idx = upperBound(sorted, x) - 2
  return idx >= 0 ? sorted[idx] : undefined
}

// A feature sharing an edge with another has no room on that side, so a pile
// on one bp thins under decimation rather than every member reading the far
// neighbour's gap as its own.
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

// Read-only so the per-factor pass cannot write here; a mutation would leak
// one probe's label decisions into the next.
