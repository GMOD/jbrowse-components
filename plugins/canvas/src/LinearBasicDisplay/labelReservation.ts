import {
  LABEL_PADDING_PX,
  renderedTextWidth,
} from '../RenderFeatureDataRPC/constants.ts'

import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LabelDecimation } from './layoutInputs.ts'

// Keyed on the room the overhang can use (the gap to the neighbour's edge),
// not box width alone, so an isolated feature keeps its name however narrow.
// `roomFactor` is not bounded below by 1: the packer always reserves the full
// name width, so a kept-but-crowded name drops a row rather than overlapping.
// An infinite factor keeps no name, an isolated one's included.
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
    (roomFactor < Infinity && availableRoomPx >= nameWidthPx * roomFactor)
  )
}

// Which of the decimation's two tiers, gene names and the rest, hold a name
// among `measureIds`.
export function namedLabelTiers(
  regions: Iterable<FeatureDataResult>,
  measureIds?: ReadonlySet<string>,
) {
  let gene = false
  let other = false
  for (const data of regions) {
    const geneIds = new Set<string>()
    for (const item of data.flatbushItems) {
      if (item.gene) {
        geneIds.add(item.featureId)
      }
    }
    for (const labelData of data.floatingLabelsData.values()) {
      const id = labelData.parentFeatureId ?? labelData.featureId
      if (labelData.nameLabel && (!measureIds || measureIds.has(id))) {
        if (geneIds.has(id)) {
          gene = true
        } else {
          other = true
        }
      }
    }
  }
  return { gene, other }
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

interface RoomSpan {
  startBp: number
  endBp: number
  gene?: boolean
}

function outranks(a: RoomSpan, b: RoomSpan) {
  return a.gene !== b.gene
    ? !!a.gene
    : a.endBp - a.startBp > b.endBp - b.startBp
}

function pileLeaders<F extends RoomSpan>(
  features: Map<string, F>,
  edge: (f: F) => number,
) {
  const leaders = new Map<number, [string, F]>()
  for (const entry of features) {
    const key = edge(entry[1])
    const leader = leaders.get(key)
    if (!leader || outranks(entry[1], leader[1])) {
      leaders.set(key, entry)
    }
  }
  return new Set([...leaders.values()].map(([id]) => id))
}

// Features sharing an edge form a pile, and only its leader (a gene, else the
// longest) reads the gap past the pile; the rest read none, so the pile thins
// to one name before that name is at risk.
export function labelOverhangRoomPx<F extends RoomSpan>(
  features: Map<string, F>,
  bpPerPx: number,
) {
  const spans = [...features.values()]
  const starts = spans.map(f => f.startBp).sort((a, b) => a - b)
  const ends = spans.map(f => f.endBp).sort((a, b) => a - b)
  const startLeaders = pileLeaders(features, f => f.startBp)
  const endLeaders = pileLeaders(features, f => f.endBp)
  const rightRoom = new Map<string, number>()
  const leftRoom = new Map<string, number>()
  for (const [id, f] of features) {
    const nextStart = starts[upperBound(starts, f.startBp)]
    const prevEnd = ends[lowerBound(ends, f.endBp) - 1]
    rightRoom.set(
      id,
      !startLeaders.has(id)
        ? 0
        : nextStart === undefined
          ? Infinity
          : (nextStart - f.startBp) / bpPerPx,
    )
    leftRoom.set(
      id,
      !endLeaders.has(id)
        ? 0
        : prevEnd === undefined
          ? Infinity
          : (f.endBp - prevEnd) / bpPerPx,
    )
  }
  return { rightRoom, leftRoom }
}
