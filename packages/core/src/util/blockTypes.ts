export function makeDisplayedRegionKey(r: {
  assemblyName: string
  refName: string
  start: number
  end: number
  reversed?: boolean
}) {
  return `${r.assemblyName}:${r.refName}:${r.start}:${r.end}${r.reversed ? ':rev' : ''}`
}

type Func<T> = (value: BaseBlock, index: number, array: BaseBlock[]) => T

export class BlockSet {
  blocks: BaseBlock[]

  constructor(blocks: BaseBlock[] = []) {
    this.blocks = blocks
  }

  *[Symbol.iterator]() {
    yield* this.blocks
  }

  push(block: BaseBlock) {
    if (isElidedBlock(block) && this.blocks.length > 0) {
      const lastBlock = this.blocks.at(-1)
      if (lastBlock && isElidedBlock(lastBlock)) {
        lastBlock.push(block)
        return
      }
    }

    this.blocks.push(block)
  }

  getBlocks() {
    return this.blocks
  }

  getRegions() {
    return this.blocks.map(block => block.toRegion())
  }

  map<T, U = this>(func: Func<T>, thisarg?: U) {
    // eslint-disable-next-line unicorn/no-array-method-this-argument
    return this.blocks.map(func, thisarg)
  }

  forEach<T, U = this>(func: Func<T>, thisarg?: U) {
    // eslint-disable-next-line unicorn/no-array-method-this-argument,unicorn/no-array-for-each
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
    const blocks = this.contentBlocks
    let total = 0
    for (let i = 0, l = blocks.length; i < l; i++) {
      total += blocks[i]!.end - blocks[i]!.start
    }
    return total
  }
}

export interface BlockData {
  key: string
  offsetPx: number
  assemblyName?: string
  refName?: string
  start?: number
  end?: number
  widthPx: number
  reversed?: boolean
  displayedRegionIndex?: number
  isLeftEndOfDisplayedRegion?: boolean
  isRightEndOfDisplayedRegion?: boolean
  parentRegion?: unknown
  variant?: string
}

export class BaseBlock {
  type = 'BaseBlock'

  public displayedRegionIndex?: number

  public reversed?: boolean

  public refName?: string

  public start?: number

  public end?: number

  public assemblyName?: string

  public key: string

  public offsetPx: number

  public widthPx = 0

  public variant?: string

  public isLeftEndOfDisplayedRegion?: boolean

  public isRightEndOfDisplayedRegion?: boolean

  public parentRegion?: unknown

  constructor(data: BlockData) {
    this.assemblyName = data.assemblyName
    this.refName = data.refName
    this.start = data.start
    this.end = data.end
    this.key = data.key
    this.offsetPx = data.offsetPx
    this.widthPx = data.widthPx
    this.reversed = data.reversed
    this.displayedRegionIndex = data.displayedRegionIndex
    this.isLeftEndOfDisplayedRegion = data.isLeftEndOfDisplayedRegion
    this.isRightEndOfDisplayedRegion = data.isRightEndOfDisplayedRegion
    this.parentRegion = data.parentRegion
    this.variant = data.variant
  }

  toRegion() {
    return {
      refName: this.refName,
      start: this.start,
      end: this.end,
      assemblyName: this.assemblyName,
      reversed: this.reversed,
    }
  }
}

export class ContentBlock extends BaseBlock {
  type = 'ContentBlock'

  assemblyName!: string
  refName!: string
  start!: number
  end!: number
}

/**
 * marker block representing one or more blocks that are
 * too small to be shown at the current zoom level
 */
function isElidedBlock(b: BaseBlock): b is ElidedBlock {
  return b.type === 'ElidedBlock'
}

export class ElidedBlock extends BaseBlock {
  type = 'ElidedBlock'

  public elidedBlockCount = 0

  push(otherBlock: ElidedBlock) {
    this.elidedBlockCount += 1
    this.refName = ''
    this.start = 0
    this.end = 0
    this.widthPx += otherBlock.widthPx
  }
}

/**
 * marker block that sits between two different displayed regions
 * and provides a thick border between them
 */
export class InterRegionPaddingBlock extends BaseBlock {
  type = 'InterRegionPaddingBlock'
}
