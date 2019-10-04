type Func<T> = (value: BaseBlock, index: number, array: BaseBlock[]) => T

export class BlockSet {
  blocks: BaseBlock[] = []

  constructor(blocks: BaseBlock[] = []) {
    this.blocks = blocks
  }

  push(block: BaseBlock) {
    if (block instanceof ElidedBlock) {
      if (this.blocks.length) {
        const lastBlock = this.blocks[this.blocks.length - 1]
        if (lastBlock instanceof ElidedBlock) {
          lastBlock.push(block)
          return
        }
      }
    }

    this.blocks.push(block)
  }

  getBlocks() {
    return this.blocks
  }

  map<T, U = this>(func: Func<T>, thisarg?: U) {
    return this.blocks.map(func, thisarg)
  }

  forEach<T, U = this>(func: Func<T>, thisarg?: U) {
    return this.blocks.forEach(func, thisarg)
  }

  get length() {
    return this.blocks.length
  }
}

export class BaseBlock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any

  public refName: string

  public start: number

  public end: number

  public assemblyName: string

  public key: string

  /**
   * a block that should be shown as filled with data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(data: any) {
    Object.assign(this, data)
    this.assemblyName = data.assemblyName
    this.refName = data.refName
    this.start = data.start
    this.end = data.end
    this.key = data.key
  }

  /**
   * rename the reference sequence of this block and return a new one
   *
   * @param {string} refName
   * @returns either a new block with a renamed reference sequence,
   * or the same block, if the ref name is not actually different
   */
  renameReference(refName: string) {
    if (this.refName && refName !== this.refName) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new (this.constructor as any)({ ...this, refName })
    }
    return this
  }

  toRegion() {
    return {
      refName: this.refName,
      start: this.start,
      end: this.end,
      assemblyName: this.assemblyName,
    }
  }
}

export class ContentBlock extends BaseBlock {}

/**
 * marker block representing one or more blocks that are
 * too small to be shown at the current zoom level
 */
export class ElidedBlock extends BaseBlock {
  private elidedBlockCount = 1

  public widthPx: number

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(data: Record<string, any>) {
    super(data)
    this.widthPx = data.widthPx
  }

  push(otherBlock: BaseBlock) {
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
