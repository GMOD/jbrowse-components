import {
  blockHasRefGap,
  forEachInsertion,
} from '../../LinearMafRenderer/rendering/forEachInsertion.ts'

import type {
  MafBlock,
  MafRegionData,
} from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { StrandConsensus } from './computeVisibleInversions.ts'

/** What one block contributes: `(positionBp, rowIndex, length)` per event. */
type FillBlock = (
  block: MafBlock,
  blockIndex: number,
  push: (positionBp: number, rowIndex: number, length: number) => void,
) => void

/**
 * A region's per-row events — insertions, inverted blocks — as
 * `(positionBp, rowIndex, length)`, with no screen position in them. Panning
 * changes only the bp→px mapping over these, so the overlays project this
 * instead of re-deriving it from the alignment bytes every frame.
 *
 * Filled per block on first touch, not per region up front: the walks are
 * proportional to the viewport, and eagerly indexing a 54k-block region made the
 * first frame after a fetch 145ms against a 4.5ms frame.
 *
 * Deletions get `regionDeletionRunBounds` instead. Insertions need a reference
 * gap and so are sparse; a deletion is any run of alignment gap, millions per
 * region — indexing what is cheap to bound is how this turns into a leak.
 *
 * Blocks are appended in first-drawn order, so a block's range is
 * `(eventStart, eventCount)` rather than the wire's ascending `blockStart`.
 */
export class MafRowEventIndex {
  private blocks: MafBlock[]

  private fillBlock: FillBlock

  private filled: Uint8Array

  private eventStart: Uint32Array

  private eventCount: Uint32Array

  private count = 0

  /**
   * Live as of the last `ensure`. Read them after it and not before: they are
   * replaced wholesale when the columns grow.
   */
  positionBp = new Uint32Array(256)

  rowIndex = new Uint32Array(256)

  length = new Uint32Array(256)

  // Plain assignments rather than parameter properties: the benches import this
  // module through node's strip-only TypeScript, which rejects those outright.
  constructor(blocks: MafBlock[], fillBlock: FillBlock) {
    this.blocks = blocks
    this.fillBlock = fillBlock
    this.filled = new Uint8Array(blocks.length)
    this.eventStart = new Uint32Array(blocks.length)
    this.eventCount = new Uint32Array(blocks.length)
  }

  private push = (positionBp: number, rowIndex: number, length: number) => {
    if (this.count === this.positionBp.length) {
      this.positionBp = grow(this.positionBp)
      this.rowIndex = grow(this.rowIndex)
      this.length = grow(this.length)
    }
    this.positionBp[this.count] = positionBp
    this.rowIndex[this.count] = rowIndex
    this.length[this.count] = length
    this.count++
  }

  /**
   * The event range of block `blockIndex`, walking it first if this is the first
   * time it has been asked for.
   */
  ensure(blockIndex: number) {
    if (!this.filled[blockIndex]) {
      const start = this.count
      this.fillBlock(this.blocks[blockIndex]!, blockIndex, this.push)
      this.eventStart[blockIndex] = start
      this.eventCount[blockIndex] = this.count - start
      this.filled[blockIndex] = 1
    }
    const from = this.eventStart[blockIndex]!
    return { from, to: from + this.eventCount[blockIndex]! }
  }
}

function grow(array: Uint32Array) {
  const next = new Uint32Array(array.length * 2)
  next.set(array)
  return next
}

/**
 * A `WeakMap` rather than a MobX computed: `placeMafRegionData` builds a fresh
 * `MafRegionData` per fetch and per row reorder — exactly when a baked
 * `rowIndex` stops being true — so a stale index is unreachable rather than
 * wrong, and one region landing doesn't rebuild the others.
 */
function cachedBy(
  cache: WeakMap<MafRegionData, MafRowEventIndex>,
  region: MafRegionData,
  fillBlock: FillBlock,
) {
  let index = cache.get(region)
  if (index === undefined) {
    index = new MafRowEventIndex(region.blocks, fillBlock)
    cache.set(region, index)
  }
  return index
}

const insertionCache = new WeakMap<MafRegionData, MafRowEventIndex>()

/**
 * Insertions: a run of reference-gap columns where a sample carries bases,
 * anchored at the reference base following the run. `blockHasRefGap` answers for
 * every row of a block at once, and most real MAF blocks have no gap at all.
 */
export function regionInsertionEvents(region: MafRegionData) {
  return cachedBy(insertionCache, region, (block, _blockIndex, push) => {
    if (blockHasRefGap(block)) {
      for (const row of block.rows) {
        forEachInsertion(
          block.refSeqBytes,
          row.alignmentBytes,
          block.startBp,
          (anchorBp, length) => {
            push(anchorBp, row.rowIndex, length)
          },
        )
      }
    }
  })
}

const inversionCache = new WeakMap<
  StrandConsensus,
  WeakMap<MafRegionData, MafRowEventIndex>
>()

/**
 * Blocks that align inverted relative to their own scaffold's consensus
 * orientation, one event per (block, row), carrying the block's reference span.
 *
 * Keyed on the consensus as well as the region: `consensusStrandByRowChr` scores
 * every *loaded* region, so a region landing elsewhere can flip which of this
 * one's blocks read as inverted. That makes the cache correct, not merely fast.
 */
export function regionInversionEvents(
  region: MafRegionData,
  consensus: StrandConsensus,
) {
  let byRegion = inversionCache.get(consensus)
  if (byRegion === undefined) {
    byRegion = new WeakMap()
    inversionCache.set(consensus, byRegion)
  }
  return cachedBy(byRegion, region, (block, _blockIndex, push) => {
    const length = block.endBp - block.startBp
    for (const row of block.rows) {
      if (
        row.strand !== undefined &&
        row.chr !== undefined &&
        row.strand !== consensus.get(row.rowIndex)?.get(row.chr)
      ) {
        push(block.startBp, row.rowIndex, length)
      }
    }
  })
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
