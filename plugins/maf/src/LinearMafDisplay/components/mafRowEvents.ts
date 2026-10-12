import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { StrandConsensus } from './computeVisibleInversions.ts'

/** The display rows of block `blockIndex` that align inverted. */
export type InvertedRows = (blockIndex: number) => readonly number[]

const NONE: readonly number[] = []

/**
 * A `WeakMap` rather than a MobX computed: `placeMafRegionData` builds a fresh
 * `MafRegionData` per fetch and per row reorder — exactly when a baked
 * `rowIndex` stops being true — so a stale entry is unreachable rather than
 * wrong, and one region landing doesn't rebuild the others.
 */
const inversionCache = new WeakMap<
  StrandConsensus,
  WeakMap<MafRegionData, InvertedRows>
>()

function invertedRowsOf(block: MafBlock, consensus: StrandConsensus) {
  let rows: number[] | undefined
  for (const row of block.rows) {
    if (
      row.strand !== undefined &&
      row.chr !== undefined &&
      row.strand !== consensus.get(row.rowIndex)?.get(row.chr)
    ) {
      ;(rows ??= []).push(row.rowIndex)
    }
  }
  return rows ?? NONE
}

/**
 * Per block, the rows that align inverted relative to their own scaffold's
 * consensus orientation. Panning changes only the bp→px mapping over these, so
 * the overlay projects them instead of re-deriving them every frame.
 *
 * Filled per block on first touch, not per region up front: eagerly walking a
 * 54k-block region made the first frame after a fetch 145ms against a 4.5ms
 * frame.
 *
 * Keyed on the consensus as well as the region: `consensusStrandByRowChr` scores
 * every *loaded* region, so a region landing elsewhere can flip which of this
 * one's blocks read as inverted. That makes the cache correct, not merely fast.
 */
export function regionInvertedRows(
  region: MafRegionData,
  consensus: StrandConsensus,
) {
  let byRegion = inversionCache.get(consensus)
  if (byRegion === undefined) {
    byRegion = new WeakMap()
    inversionCache.set(consensus, byRegion)
  }
  let invertedRows = byRegion.get(region)
  if (invertedRows === undefined) {
    const filled = new Array<readonly number[] | undefined>(
      region.blocks.length,
    )
    invertedRows = blockIndex =>
      (filled[blockIndex] ??= invertedRowsOf(
        region.blocks[blockIndex]!,
        consensus,
      ))
    byRegion.set(region, invertedRows)
  }
  return invertedRows
}

const deletionRunCache = new WeakMap<MafRegionData, Uint32Array>()

/**
 * Longest deletion run per block, over **all** its rows — `0` while unwalked,
 * else that run plus one. Over all rows so it survives a scroll; a length rather
 * than a verdict so it survives a zoom. `computeVisibleDeletions` fills it from
 * the walk that emits the frame's markers, since measuring separately would cost
 * more than the bound saves.
 */
export function regionDeletionRunBounds(region: MafRegionData) {
  let bounds = deletionRunCache.get(region)
  if (bounds === undefined) {
    bounds = new Uint32Array(region.blocks.length)
    deletionRunCache.set(region, bounds)
  }
  return bounds
}
