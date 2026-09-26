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

// Each edge's leader, with the size of its pile.
function pileLeaders<F extends RoomSpan>(
  features: Map<string, F>,
  edge: (f: F) => number,
  nameWidthPx: (id: string) => number,
) {
  const piles = new Map<number, { id: string; f: F; size: number }>()
  for (const [id, f] of features) {
    if (nameWidthPx(id) <= 0) {
      continue
    }
    const key = edge(f)
    const pile = piles.get(key)
    if (!pile) {
      piles.set(key, { id, f, size: 1 })
    } else {
      pile.size++
      if (outranks(f, pile.f)) {
        pile.id = id
        pile.f = f
      }
    }
  }
  return new Map([...piles.values()].map(p => [p.id, p.size]))
}

// The widest room a pile leader reads, as a multiple of its name width. Its
// name sits on the pile, so it usually costs height, and past this factor it
// goes before a lone feature's name, which usually costs none.
export const PILE_LEADER_MAX_ROOM_FACTOR = 8

// Features sharing an edge form a pile, and only its leader (a named gene,
// else the longest named member) reads the gap past the pile; the rest read
// none, so the pile thins to one name before that name is at risk.
export function labelOverhangRoomPx<F extends RoomSpan>(
  features: Map<string, F>,
  bpPerPx: number,
  nameWidthPx: (id: string) => number = () => 1,
) {
  const spans = [...features.values()]
  const starts = spans.map(f => f.startBp).sort((a, b) => a - b)
  const ends = spans.map(f => f.endBp).sort((a, b) => a - b)
  const startLeaders = pileLeaders(features, f => f.startBp, nameWidthPx)
  const endLeaders = pileLeaders(features, f => f.endBp, nameWidthPx)
  const room = (id: string, pileSize: number | undefined, gapPx: number) =>
    pileSize === undefined
      ? 0
      : pileSize > 1
        ? Math.min(gapPx, nameWidthPx(id) * PILE_LEADER_MAX_ROOM_FACTOR)
        : gapPx
  const rightRoom = new Map<string, number>()
  const leftRoom = new Map<string, number>()
  for (const [id, f] of features) {
    const nextStart = starts[upperBound(starts, f.startBp)]
    const prevEnd = ends[lowerBound(ends, f.endBp) - 1]
    rightRoom.set(
      id,
      room(
        id,
        startLeaders.get(id),
        nextStart === undefined ? Infinity : (nextStart - f.startBp) / bpPerPx,
      ),
    )
    leftRoom.set(
      id,
      room(
        id,
        endLeaders.get(id),
        prevEnd === undefined ? Infinity : (f.endBp - prevEnd) / bpPerPx,
      ),
    )
  }
  return { rightRoom, leftRoom }
}
