import { inDevelopment } from '..'

export default class SceneGraph {
  /**
   * note: all coordinates are inter-base or inter-pixel coordinates
   */
  constructor(name, left, top, width, height, data) {
    if (
      inDevelopment
      && (typeof name !== 'string'
        || typeof left !== 'number'
        || Number.isNaN(left)
        || typeof top !== 'number'
        || Number.isNaN(top)
        || typeof width !== 'number'
        || Number.isNaN(width)
        || typeof height !== 'number'
        || Number.isNaN(height))
    ) {
      throw new TypeError('invalid SceneGraph arguments')
    }

    this.name = name
    this.left = left
    this.top = top
    this.width = width
    this.height = height
    this.data = data
    this.children = new Map()
    this.absoluteCache = { dirty: true }
  }

  addChild(...args) {
    let child
    if (args.length === 1) [child] = args
    else child = new SceneGraph(...args)

    if (!(child instanceof SceneGraph)) {
      throw new TypeError(
        'argument to addChild must be an array or a SceneGraph',
      )
    }

    if (this.children.has(child.name)) throw new Error(`child named "${child.name}" already exists`)

    // update the bounds to match the child
    child.parent = this
    const {
      left, right, top, bottom,
    } = child.absolute
    this.expand(left, right, top, bottom)
    this.children.set(child.name, child)
  }

  getSubRecord(name) {
    return this.children.get(name)
  }

  /**
   * if the record does not already cover the given
   * absolute extents, extend it to cover them
   *
   * @param {number} left
   * @param {number} right
   * @param {number} top
   * @param {number} bottom
   */
  expand(newLeft, newRight, newTop, newBottom) {
    const {
      left, right, top, bottom,
    } = this.absolute
    if (newLeft < left) {
      const diff = left - newLeft
      this.width += diff
      this.left -= diff
    }
    if (newRight > right) {
      this.width += newRight - right
    }
    if (newTop < top) {
      const diff = top - newTop
      this.height += diff
      this.top -= diff
    }
    if (newBottom > bottom) {
      this.height += newBottom - bottom
    }
    if (this.parent) this.parent.expand(newLeft, newRight, newTop, newBottom)
    this.absoluteCache.dirty = true
  }

  get bottom() {
    return this.top + this.height
  }

  get right() {
    return this.left + this.width
  }

  walkParents(callback) {
    if (this.parent) {
      callback(this.parent)
      this.parent.walkParents(callback)
    }
  }

  walkChildren(callback) {
    for (const sub of this.children.values()) {
      callback(sub)
      sub.walkChildren(callback)
    }
  }

  get absolute() {
    if (this.absoluteCache.dirty) {
      let xOffset = 0
      let yOffset = 0
      this.walkParents((node) => {
        xOffset += node.left
        yOffset += node.top
      })
      this.absoluteCache = {
        dirty: false,
        left: this.left + xOffset,
        right: this.right + xOffset,
        top: this.top + yOffset,
        bottom: this.bottom + yOffset,
        width: this.width,
        height: this.height,
      }
    }
    return this.absoluteCache
  }

  move(x, y) {
    this.left += x
    this.top += y

    this.absoluteCache.dirty = true
    this.walkChildren((c) => {
      c.absoluteCache.dirty = true
    })
  }
}
