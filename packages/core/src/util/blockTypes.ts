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
  parentRegion?: unknown
  variant?: string
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
  elidedBlockCount: number
}

export interface InterRegionPaddingBlock extends BlockData {
  type: 'InterRegionPaddingBlock'
}

export type BaseBlock = ContentBlock | ElidedBlock | InterRegionPaddingBlock

export function makeContentBlock(data: Omit<ContentBlock, 'type'>): ContentBlock {
  return { ...data, type: 'ContentBlock' }
}

export function makeElidedBlock(
  data: Omit<ElidedBlock, 'type' | 'elidedBlockCount'>,
): ElidedBlock {
  return { ...data, type: 'ElidedBlock', elidedBlockCount: 0 }
}

export function makeInterRegionPaddingBlock(
  data: Omit<InterRegionPaddingBlock, 'type'>,
): InterRegionPaddingBlock {
  return { ...data, type: 'InterRegionPaddingBlock' }
}

export function blockToRegion(b: BaseBlock) {
  return {
    refName: b.refName,
    start: b.start,
    end: b.end,
    assemblyName: b.assemblyName,
    reversed: b.reversed,
  }
}

function isElidedBlock(b: BaseBlock): b is ElidedBlock {
  return b.type === 'ElidedBlock'
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
      const last = this.blocks.at(-1)
      if (last && isElidedBlock(last)) {
        last.elidedBlockCount += 1
        last.refName = ''
        last.start = 0
        last.end = 0
        last.widthPx += block.widthPx
        return
      }
    }
    this.blocks.push(block)
  }

  getBlocks() {
    return this.blocks
  }

  getRegions() {
    return this.blocks.map(blockToRegion)
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
