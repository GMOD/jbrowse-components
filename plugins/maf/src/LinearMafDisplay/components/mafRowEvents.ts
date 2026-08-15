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
 * Everything a region's blocks say about one kind of per-row event — an
 * insertion, an inverted block — as absolute genomic spans on display rows, with
 * no screen position in it.
 *
 * That separation is the point. `(positionBp, rowIndex, length)` is a fact about
 * the alignment: **panning does not change it**, only the bp→px mapping over it.
 * The overlay walks used to rediscover these facts from the alignment bytes on
 * every frame — a per-column scan of every visible block × row — so a pan
 * re-derived an answer it already had. agent-docs/reference/MAF_LARGE_BLOCKS.md
 * names this as the next step, and names the insertion walk as the one to be
 * careful with because its geometry is shared with the hover hit-test: the
 * shared walk (`forEachInsertion`) is what fills this, and the hover still calls
 * it directly for the one row under the cursor, so the two cannot disagree.
 *
 * **Filled per block, on first touch, not per region up front**, which is the
 * difference between a memo and a stall. A whole-region build inverts the cost
 * model the walks already had: they are proportional to the *viewport*, so
 * eagerly indexing a region makes the first frame after a fetch proportional to
 * the buffered span instead — measured at 145ms against a 4.5ms frame when
 * zoomed in on a 54k-block region, a jank on every navigation in exchange for
 * cheaper pans. Filling only the blocks the bp cull admits keeps every frame
 * proportional to what it draws, and a full pan across the region still ends up
 * having walked it exactly once.
 *
 * **Deletions deliberately have none**, and the reason is the shape of the data
 * rather than the shape of the code: an insertion needs a reference gap to exist
 * at all, so insertions are sparse, while a deletion is any run of alignment gap
 * — a few percent of every row on a divergent alignment, millions of events per
 * region where insertions are hundreds of thousands. They get an exact per-block
 * bound instead (`computeVisibleDeletions`), which costs nothing and does the
 * same job better. Indexing what is cheap to bound is how a per-frame walk turns
 * into a per-region memory leak.
 *
 * Columnar: three growable typed arrays for the whole region whatever the event
 * count, plus three small per-block ones, rather than an object per event or an
 * array per block. Blocks are appended in the order they are first drawn, so the
 * per-block range is `(eventStart, eventCount)` rather than the wire's ascending
 * `blockStart` sentinel — the one place this shape differs from `MafWireRegionData`.
 *
 * Order within a block is row order, then the walk's own order within a row —
 * the same order the per-frame walks emitted in.
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
 * Cache an index against the region object it describes.
 *
 * A `WeakMap` rather than a MobX computed for two reasons. It invalidates
 * itself: `placeMafRegionData` builds a fresh `MafRegionData` for a region on
 * every fetch **and** on every row reorder, which is exactly when a baked
 * `rowIndex` stops being true — so a stale index is unreachable rather than
 * merely wrong. And it is per region, where a computed over `rpcDataMap` would
 * rebuild every loaded region's events because one of them landed. Same shape
 * and the same reasoning as the alignments display's `maxFeatureLengths`.
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
 * anchored at the reference base following the run.
 *
 * `blockHasRefGap` is what keeps filling this affordable — most blocks of a real
 * MAF have no reference gap at all, and it answers for every row of one at once,
 * off the block's own `endBp`.
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

/**
 * Blocks that align inverted relative to their own scaffold's consensus
 * orientation, one event per (block, row), carrying the block's reference span.
 *
 * Cached against the consensus as well as the region, because unlike insertions
 * this is not a fact about the region alone: `consensusStrandByRowChr` is scored
 * across every *loaded* region, so a region landing elsewhere can flip which of
 * this one's blocks read as inverted. The consensus is a fresh Map whenever that
 * happens (a MobX computed), so keying on it is what makes the cache correct
 * rather than merely fast — and the outer `WeakMap` drops a whole generation of
 * indexes when the consensus they belong to is replaced.
 */
const inversionCache = new WeakMap<
  StrandConsensus,
  WeakMap<MafRegionData, MafRowEventIndex>
>()

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
