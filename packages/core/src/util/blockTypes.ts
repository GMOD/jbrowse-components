interface BlockData {
  key: string
  offsetPx: number
  widthPx: number
  assemblyName?: string
  refName?: string
  start?: number
  end?: number
  reversed?: boolean
  displayedRegionIndex?: number
  isLeftEndOfDisplayedRegion?: boolean
  isRightEndOfDisplayedRegion?: boolean
  variant?: 'boundary'
}

export interface ContentBlock extends BlockData {
  type: 'ContentBlock'
  assemblyName: string
  refName: string
  start: number
  end: number
}

export interface ElidedBlock extends BlockData {
  type: 'ElidedBlock'
}

export interface InterRegionPaddingBlock extends BlockData {
  type: 'InterRegionPaddingBlock'
}

export type BaseBlock = ContentBlock | ElidedBlock | InterRegionPaddingBlock

/**
 * A content block as a region that addresses whole bases.
 *
 * `calculateDynamicBlocks` says in its own docstring that start/end may be
 * FRACTIONAL — a block is a span of screen, and the view is only at a whole
 * base when the pan and the zoom both happen to land there. Anything naming
 * bases rather than pixels needs this: a sequence fetch, a bookmark, and above
 * all a locString, since `BP_QUANTITY_SOURCE` rejects a bare fractional
 * coordinate on purpose ("a bare '1.5' as a coordinate is a mistake").
 *
 * `reversed` is dropped with the pixels. It orients a projection, and a region
 * that has left the screen is not being projected; carrying it only reached
 * `assembleLocString`, which spells it `[rev]` in a field the user is about to
 * read.
 */
export function wholeBaseRegion(block: ContentBlock) {
  return {
    assemblyName: block.assemblyName,
    refName: block.refName,
    start: Math.floor(block.start),
    end: Math.ceil(block.end),
  }
}

export function wholeBaseRegions(blocks: ContentBlock[]) {
  return blocks.map(wholeBaseRegion)
}

type Func<T> = (value: BaseBlock, index: number, array: BaseBlock[]) => T

// A merged elided run can span several displayed regions, so its per-region
// identity is meaningless: refName/start/end are cleared and only widthPx stays
// valid. The leftover key, assemblyName, displayedRegionIndex,
// isRightEndOfDisplayedRegion belong to the FIRST sub-block — don't key off them
// for an ElidedBlock.
function mergeElided(run: ElidedBlock, widthPx: number) {
  run.refName = ''
  run.start = 0
  run.end = 0
  run.widthPx += widthPx
}

export class BlockSet {
  blocks: BaseBlock[]

  constructor(blocks: BaseBlock[] = []) {
    this.blocks = blocks
  }

  push(block: BaseBlock) {
    const last = this.blocks.at(-1)
    if (block.type === 'ElidedBlock' && last?.type === 'ElidedBlock') {
      mergeElided(last, block.widthPx)
    } else {
      this.blocks.push(block)
    }
  }

  /**
   * Widen a trailing elided run by widthPx, reporting whether there was one to
   * widen. `push` keeps nothing but the width off an ElidedBlock it merges, so
   * a caller holding the width can skip building the block that would have
   * carried it — which at whole-genome zoom is nearly every region, see
   * calculateDynamicBlocks.
   */
  growElidedRun(widthPx: number) {
    const last = this.blocks.at(-1)
    if (last?.type !== 'ElidedBlock') {
      return false
    }
    mergeElided(last, widthPx)
    return true
  }

  map<T, U = this>(func: Func<T>, thisarg?: U) {
    // deliberately mirrors Array#map's (callback, thisArg) signature
    // eslint-disable-next-line unicorn/no-array-method-this-argument
    return this.blocks.map(func, thisarg)
  }

  forEach<T, U = this>(func: Func<T>, thisarg?: U) {
    // deliberately mirrors Array#forEach's (callback, thisArg) signature
    // eslint-disable-next-line unicorn/no-array-method-this-argument
    this.blocks.forEach(func, thisarg)
  }

  get length() {
    return this.blocks.length
  }

  get totalWidthPx() {
    let total = 0
    for (let i = 0, l = this.blocks.length; i < l; i++) {
      total += this.blocks[i]!.widthPx
    }
    return total
  }

  get totalWidthPxWithoutBorders() {
    let total = 0
    for (let i = 0, l = this.blocks.length; i < l; i++) {
      if (this.blocks[i]!.variant !== 'boundary') {
        total += this.blocks[i]!.widthPx
      }
    }
    return total
  }

  get offsetPx() {
    return this.blocks.length > 0 ? this.blocks[0]!.offsetPx : 0
  }

  get contentBlocks() {
    return this.blocks.filter(
      (block): block is ContentBlock => block.type === 'ContentBlock',
    )
  }

  get totalBp() {
    let total = 0
    for (let i = 0, l = this.blocks.length; i < l; i++) {
      const b = this.blocks[i]!
      if (b.type === 'ContentBlock') {
        total += b.end - b.start
      }
    }
    return total
  }
}
