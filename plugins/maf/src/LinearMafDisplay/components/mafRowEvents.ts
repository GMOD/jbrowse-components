import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { StrandConsensus } from './computeVisibleInversions.ts'

/** The display rows of block `blockIndex` that align inverted. */
export type InvertedRows = (blockIndex: number) => readonly number[]

const NONE: readonly number[] = []

/**
 * A `WeakMap`, not a MobX computed: `placeMafRegionData` builds a fresh
 * `MafRegionData` per fetch and reorder, exactly when a baked `rowIndex` stops
 * being true, so a stale entry is unreachable rather than wrong.
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
      row.srcRefName !== undefined &&
      row.strand !== consensus.get(row.rowIndex)?.get(row.srcRefName)
    ) {
      ;(rows ??= []).push(row.rowIndex)
    }
  }
  return rows ?? NONE
}

/**
 * Per block, the rows that align inverted relative to their scaffold's
 * consensus orientation. Filled per block on first touch: walking a 54k-block
 * region eagerly cost 145ms in the first frame after a fetch.
 *
 * Keyed on the consensus as well as the region, since `consensusStrandByRowRefName`
 * scores every loaded region and a landing region can flip which blocks read as
 * inverted.
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
 * Longest deletion run per block over all its rows: `0` while unwalked, else
 * that run plus one. A length rather than a verdict so it survives a zoom.
 * `computeVisibleDeletions` fills it from the walk that emits the frame's
 * markers.
 */
export function regionDeletionRunBounds(region: MafRegionData) {
  let bounds = deletionRunCache.get(region)
  if (bounds === undefined) {
    bounds = new Uint32Array(region.blocks.length)
    deletionRunCache.set(region, bounds)
  }
  return bounds
}
