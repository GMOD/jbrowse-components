import { EMPTY_INSERTIONS } from '@jbrowse/alignments-core'

import { regionWithDeltas } from './featurePainting.ts'
import { rowBand } from './rowBand.ts'

import type { MultiRowEncoded } from './multiRowChannels.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
  MultiRowUploadData,
} from './multiRowRenderingBackendTypes.ts'
import type {
  InsertionChannels,
  InsertionParams,
} from '@jbrowse/alignments-core'

/**
 * The insertion mark's channels, plus which encoded channel each marker came
 * from, so the hover can name the marker its block wears.
 */
export interface MultiRowInsertions extends InsertionChannels {
  channel: Uint32Array
}

/**
 * One entry per drawn block whose `lengthField` delta is a loss: `x..x2` is
 * the block's reference span, `length` the bp lost, which equals the span only
 * where the allele has no sequence there at all; `row` and `color` are the
 * block's own channels, so the label reads against the block's paint.
 */
export interface MultiRowDeletions {
  x: Uint32Array
  x2: Uint32Array
  row: Uint32Array
  length: Uint32Array
  color: Uint32Array
  count: number
}

const NO_INSERTIONS: MultiRowInsertions = {
  ...EMPTY_INSERTIONS,
  channel: new Uint32Array(0),
}

const NO_DELETIONS: MultiRowDeletions = {
  x: new Uint32Array(0),
  x2: new Uint32Array(0),
  row: new Uint32Array(0),
  length: new Uint32Array(0),
  color: new Uint32Array(0),
  count: 0,
}

/**
 * One insertion-mark instance per drawn block whose `lengthField` delta is a
 * gain: centred on the block, since the allele replaces that whole span and
 * has no boundary to sit at, on the block's row key, in `insertionAbgr`, the
 * theme's `insertion` the pileup paints. `under` is the block's own color,
 * which a count reads against where the block is wider than its marker.
 */
function insertionChannels(
  encoded: MultiRowEncoded,
  { featureStarts, featureEnds, featureDeltas }: MultiRowRegionData,
  picked: number[],
  insertionAbgr: number,
): MultiRowInsertions {
  const count = picked.length
  if (count === 0) {
    return NO_INSERTIONS
  }
  const x = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const row = new Uint32Array(count)
  const length = new Uint32Array(count)
  const color = new Uint32Array(count).fill(insertionAbgr)
  const under = new Uint32Array(count)
  const channel = Uint32Array.from(picked)
  for (const [o, c] of picked.entries()) {
    const i = encoded.featureIndex[c]!
    x[o] = featureStarts[i]!
    x2[o] = featureEnds[i]!
    row[o] = encoded.row[c]!
    length[o] = featureDeltas[i]!
    under[o] = encoded.color[c]!
  }
  return { x, x2, row, length, color, under, channel, count }
}

function deletionChannels(
  encoded: MultiRowEncoded,
  { featureStarts, featureEnds, featureDeltas }: MultiRowRegionData,
  picked: number[],
): MultiRowDeletions {
  const count = picked.length
  if (count === 0) {
    return NO_DELETIONS
  }
  const x = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const row = new Uint32Array(count)
  const length = new Uint32Array(count)
  const color = new Uint32Array(count)
  for (const [o, c] of picked.entries()) {
    const i = encoded.featureIndex[c]!
    x[o] = featureStarts[i]!
    x2[o] = featureEnds[i]!
    row[o] = encoded.row[c]!
    length[o] = -featureDeltas[i]!
    color[o] = encoded.color[c]!
  }
  return { x, x2, row, length, color, count }
}

/**
 * One region's encode with the indels its drawn blocks' `lengthField` deltas
 * carry, so every indel painter reads the encode the blocks were drawn from
 * and a glyph hides, moves and recolors with its block.
 */
export function multiRowUploadData(
  encoded: MultiRowEncoded,
  data: MultiRowRegionData | undefined,
  insertionAbgr: number,
): MultiRowUploadData {
  const region = regionWithDeltas(data)
  if (!region) {
    return { ...encoded, insertions: NO_INSERTIONS, deletions: NO_DELETIONS }
  }
  const gains: number[] = []
  const losses: number[] = []
  for (let c = 0; c < encoded.count; c++) {
    const delta = region.featureDeltas[encoded.featureIndex[c]!]!
    if (delta > 0) {
      gains.push(c)
    } else if (delta < 0) {
      losses.push(c)
    }
  }
  return {
    ...encoded,
    insertions: insertionChannels(encoded, region, gains, insertionAbgr),
    deletions: deletionChannels(encoded, region, losses),
  }
}

/** The marker index the block at encoded channel `c` wears, if any. */
export function insertionOfChannel(insertions: MultiRowInsertions, c: number) {
  const k = insertions.channel.indexOf(c)
  return k === -1 ? undefined : k
}

/**
 * Each marker on its block's band, drawn where it is wider than the block's
 * reference span.
 */
export function multiRowInsertionParams(
  s: MultiRowRenderState,
): InsertionParams {
  const band = rowBand(s.rowHeight, s.rowProportion)
  return {
    rowHeight: s.rowHeight,
    rowOffsetPx: band.offset,
    bandHeightPx: band.height,
    spanFloorPx: 0,
    outline: false,
    rowTable: s.rowTable,
  }
}
