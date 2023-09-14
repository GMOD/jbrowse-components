import { sum } from '@jbrowse/core/util'

type Func<T> = (value: BaseBlock, index: number, array: BaseBlock[]) => T

export class BlockSet {
  constructor(public blocks: BaseBlock[] = []) {}

  push(block: BaseBlock) {
    if (block instanceof ElidedBlock && this.blocks.length > 0) {
      const lastBlock = this.blocks.at(-1)
      if (lastBlock instanceof ElidedBlock) {
        lastBlock.push(block)
        return
      }
    }

    this.blocks.push(block)
  }

  getBlocks() {
    return this.blocks
  }

  map<T, U = this>(func: Func<T>, thisarg?: U) {
    // eslint-disable-next-line unicorn/no-array-method-this-argument
    return this.blocks.map(func, thisarg)
  }

  forEach<T, U = this>(func: Func<T>, thisarg?: U) {
    // eslint-disable-next-line unicorn/no-array-method-this-argument
    return this.blocks.forEach(func, thisarg)
  }

  get length() {
    return this.blocks.length
  }

  get totalWidthPx() {
    return this.blocks.length
      ? sum(this.blocks.map(blocks => blocks.widthPx))
      : 0
  }

  get offsetPx() {
    return this.blocks.length ? this.blocks[0].offsetPx : 0
  }

  get contentBlocks() {
    return this.blocks.filter(block => block instanceof ContentBlock)
  }
}

export class BaseBlock {
  public reversed?: boolean

  public refName: string

  public start: number

  public end: number

  public assemblyName: string

  public key: string

  public widthPx = 0

  public offsetPx = 0

  /**
   * a block that should be shown as filled with data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(data: Record<string, any>) {
    Object.assign(this, data)
    this.assemblyName = data.assemblyName
    this.refName = data.refName
    this.start = data.start
    this.end = data.end
    this.key = data.key
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

export class ContentBlock extends BaseBlock {}

/**
 * marker block representing one or more blocks that are
 * too small to be shown at the current zoom level
 */
export class ElidedBlock extends BaseBlock {
  public widthPx: number

  public elidedBlockCount = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(data: Record<string, any>) {
    super(data)
    this.widthPx = data.widthPx
  }

  push(otherBlock: ElidedBlock) {
    this.elidedBlockCount += 1

    if (otherBlock) {
      this.refName = ''
      this.start = 0
      this.end = 0
      this.widthPx += otherBlock.widthPx
    }
  }
}

/**
 * marker block that sits between two different displayed regions
 * and provides a thick border between them
 */
export class InterRegionPaddingBlock extends BaseBlock {}
