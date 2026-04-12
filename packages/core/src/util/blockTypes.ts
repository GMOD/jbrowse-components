export function makeDisplayedRegionKey(r: {
  assemblyName: string
  refName: string
  start: number
  end: number
  reversed?: boolean
}) {
  return `${r.assemblyName}:${r.refName}:${r.start}:${r.end}${r.reversed ? ':rev' : ''}`
}

export interface BlockData {
  assemblyName: string
  refName: string
  start: number
  end: number
  reversed?: boolean
  offsetPx: number
  parentRegion: {
    assemblyName: string
    refName: string
    start: number
    end: number
    reversed?: boolean
  }
  regionNumber: number
  widthPx: number
  isLeftEndOfDisplayedRegion: boolean
  isRightEndOfDisplayedRegion: boolean
  key: string
}

interface PaddingBlockData {
  key: string
  widthPx: number
  offsetPx: number
  variant?: string
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
    if (block.type === 'ElidedBlock' && this.blocks.length > 0) {
      const lastBlock = this.blocks.at(-1)
      if (lastBlock?.type === 'ElidedBlock') {
        ;(lastBlock as ElidedBlock).push(block as ElidedBlock)
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
    return this.blocks.filter(block => block.type === 'ContentBlock')
  }

  get totalBp() {
    let total = 0
    for (let i = 0, l = this.contentBlocks.length; i < l; i++) {
      const b = this.contentBlocks[i]!
      total += b.end - b.start
    }
    return total
  }
}

export class BaseBlock {
  type = 'BaseBlock'

  regionNumber?: number

  reversed?: boolean

  // Fields set via Object.assign in constructor; ! asserts definite assignment
  refName!: string

  start!: number

  end!: number

  assemblyName!: string

  key!: string

  offsetPx!: number

  widthPx = 0

  variant?: string

  isLeftEndOfDisplayedRegion?: boolean

  constructor(data: BlockData | PaddingBlockData) {
    Object.assign(this, data)
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
}

/**
 * marker block representing one or more blocks that are
 * too small to be shown at the current zoom level
 */
export class ElidedBlock extends BaseBlock {
  type = 'ElidedBlock'

  public widthPx: number

  public elidedBlockCount = 0

  constructor(data: BlockData) {
    super(data)
    // explicit assignment needed: ElidedBlock re-declares widthPx without an
    // initializer, which in useDefineForClassFields mode would overwrite the
    // value set by Object.assign in super()
    this.widthPx = data.widthPx
  }

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
