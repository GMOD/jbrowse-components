export class BlockSet {
  blocks = []

  constructor(blocks = []) {
    this.blocks = blocks
  }

  push(block) {
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

  map(func, thisarg) {
    return this.blocks.map(func, thisarg)
  }

  forEach(func, thisarg) {
    return this.blocks.forEach(func, thisarg)
  }

  get length() {
    return this.blocks.length
  }

  get totalWidthPx() {
    return this.blocks.length
      ? this.blocks.map(blocks => blocks.widthPx).reduce((a, b) => a + b)
      : 0
  }

  get offsetPx() {
    return this.blocks.length ? this.blocks[0].offsetPx : 0
  }
}

class BaseBlock {
  /**
   * a block that should be shown as filled with data
   */
  constructor(data) {
    Object.assign(this, data)
  }

  /**
   * rename the reference sequence of this block and return a new one
   *
   * @param {string} refName
   * @returns either a new block with a renamed reference sequence,
   * or the same block, if the ref name is not actually different
   */
  renameReference(refName) {
    if (this.refName && refName !== this.refName) {
      return new ContentBlock({ ...this, refName })
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
  elidedBlockCount = 1

  push(otherBlock) {
    this.elidedBlockCount += 1

    if (otherBlock) {
      this.refName = ''
      this.start = 0
      this.end = 0
      this.widthPx += otherBlock.widthPx
    }
  }
}
