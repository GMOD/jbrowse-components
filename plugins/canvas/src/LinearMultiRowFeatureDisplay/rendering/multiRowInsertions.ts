import { EMPTY_INSERTIONS } from '@jbrowse/alignments-core'

import { regionWithDeltas } from './featurePainting.ts'
import { rowBand } from './rowBand.ts'

import type { MultiRowEncoded } from './multiRowChannels.ts'
import type {
  MultiRowRegionData,
  MultiRowRenderState,
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

const NO_INSERTIONS: MultiRowInsertions = {
  ...EMPTY_INSERTIONS,
  channel: new Uint32Array(0),
}

/**
 * One insertion-mark instance per drawn block whose `lengthField` delta is a
 * gain: centred on the block, since the allele replaces that whole span and
 * has no boundary to sit at, on the block's row key, in `insertionAbgr`, the
 * theme's `insertion` the pileup paints. `under` is the block's own colour,
 * which a count reads against where the block is wider than its marker.
 */
export function multiRowInsertionChannels(
  encoded: MultiRowEncoded,
  data: MultiRowRegionData | undefined,
  insertionAbgr: number,
): MultiRowInsertions {
  const region = regionWithDeltas(data)
  if (!region) {
    return NO_INSERTIONS
  }
  const { featureStarts, featureEnds, featureDeltas } = region
  let count = 0
  for (let c = 0; c < encoded.count; c++) {
    if (featureDeltas[encoded.featureIndex[c]!]! > 0) {
      count++
    }
  }
  if (count === 0) {
    return NO_INSERTIONS
  }
  const x = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const row = new Uint32Array(count)
  const length = new Uint32Array(count)
  const color = new Uint32Array(count).fill(insertionAbgr)
  const under = new Uint32Array(count)
  const channel = new Uint32Array(count)
  let o = 0
  for (let c = 0; c < encoded.count; c++) {
    const i = encoded.featureIndex[c]!
    const delta = featureDeltas[i]!
    if (delta > 0) {
      x[o] = featureStarts[i]!
      x2[o] = featureEnds[i]!
      row[o] = encoded.row[c]!
      length[o] = delta
      under[o] = encoded.color[c]!
      channel[o] = c
      o++
    }
  }
  return { x, x2, row, length, color, under, channel, count }
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
