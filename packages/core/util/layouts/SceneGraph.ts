interface AbsoluteCache {
  dirty: boolean
  left?: number
  right?: number
  top?: number
  bottom?: number
  width?: number
  height?: number
}

export default class SceneGraph {
  private children: Map<string, SceneGraph>

  private absoluteCache: AbsoluteCache

  public parent?: SceneGraph

  /**
   * note: all coordinates are inter-base or inter-pixel coordinates
   */
  constructor(
    public name: string,
    public left: number,
    public top: number,
    public width: number,
    public height: number,

    public data?: Record<string, any>,
  ) {
    this.children = new Map()
    this.absoluteCache = { dirty: true }
  }

  addChild(
    nameOrSceneGraph: string | SceneGraph,
    left: number,
    top: number,
    width: number,
    height: number,

    data?: Record<string, any>,
  ) {
    const child =
      nameOrSceneGraph instanceof SceneGraph
        ? nameOrSceneGraph
        : new SceneGraph(nameOrSceneGraph, left, top, width, height, data)

    if (!(child instanceof SceneGraph)) {
      throw new TypeError(
        'argument to addChild must be an array or a SceneGraph',
      )
    }

    if (this.children.has(child.name)) {
      throw new Error(`child named "${child.name}" already exists`)
    }

    // update the bounds to match the child
    child.parent = this
    const {
      left: childLeft,
      right: childRight,
      top: childTop,
      bottom: childBottom,
    } = child.absolute
    if (
      childLeft !== undefined &&
      childRight !== undefined &&
      childTop !== undefined &&
      childBottom !== undefined
    ) {
      this.expand(childLeft, childRight, childTop, childBottom)
      this.children.set(child.name, child)
    }
    return child
  }

  getSubRecord(name: string) {
    return this.children.get(name)
  }

  /**
   * if the record does not already cover the given absolute extents, extend it
   * to cover them
   *
   * @param left -
   * @param right -
   * @param top -
   * @param bottom -
   */
  expand(newLeft: number, newRight: number, newTop: number, newBottom: number) {
    const { left, right, top, bottom } = this.absolute

    if (left !== undefined && newLeft < left) {
      const diff = left - newLeft
      this.width += diff
      this.left -= diff
    }
    if (right !== undefined && newRight > right) {
      this.width += newRight - right
    }
    if (top !== undefined && newTop < top) {
      const diff = top - newTop
      this.height += diff
      this.top -= diff
    }
    if (bottom !== undefined && newBottom > bottom) {
      this.height += newBottom - bottom
    }
    if (this.parent) {
      this.parent.expand(newLeft, newRight, newTop, newBottom)
    }
    this.absoluteCache.dirty = true
  }

  get bottom() {
    return this.top + this.height
  }

  get right() {
    return this.left + this.width
  }

  walkParents(callback: (arg: SceneGraph) => void) {
    if (this.parent) {
      callback(this.parent)
      this.parent.walkParents(callback)
    }
  }

  walkChildren(callback: (c: SceneGraph) => void) {
    for (const sub of this.children.values()) {
      callback(sub)
      sub.walkChildren(callback)
    }
  }

  get absolute() {
    if (this.absoluteCache.dirty) {
      let xOffset = 0
      let yOffset = 0
      this.walkParents((node: SceneGraph) => {
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

  move(x: number, y: number) {
    this.left += x
    this.top += y

    this.absoluteCache.dirty = true
    this.walkChildren(c => {
      c.absoluteCache.dirty = true
    })
    const { left, right, top, bottom } = this.absolute
    if (
      left !== undefined &&
      right !== undefined &&
      top !== undefined &&
      bottom !== undefined
    ) {
      this.expand(left, right, top, bottom)
    }
  }
}
