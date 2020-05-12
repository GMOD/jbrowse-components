import { inDevelopment } from '..'

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
  private name: string

  public left: number

  public top: number

  public width: number

  public height: number

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public data?: Record<string, any>

  private children: Map<string, SceneGraph>

  private absoluteCache: AbsoluteCache

  public parent?: SceneGraph

  /**
   * note: all coordinates are inter-base or inter-pixel coordinates
   */
  constructor(
    name: string,
    left: number,
    top: number,
    width: number,
    height: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>,
  ) {
    if (
      inDevelopment &&
      (typeof name !== 'string' ||
        typeof left !== 'number' ||
        Number.isNaN(left) ||
        typeof top !== 'number' ||
        Number.isNaN(top) ||
        typeof width !== 'number' ||
        Number.isNaN(width) ||
        typeof height !== 'number' ||
        Number.isNaN(height))
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

  addChild(
    nameOrSceneGraph: string | SceneGraph,
    left: number,
    top: number,
    width: number,
    height: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>,
  ): SceneGraph {
    let child: SceneGraph
    if (nameOrSceneGraph instanceof SceneGraph) child = nameOrSceneGraph
    else
      child = new SceneGraph(nameOrSceneGraph, left, top, width, height, data)

    if (!(child instanceof SceneGraph)) {
      throw new TypeError(
        'argument to addChild must be an array or a SceneGraph',
      )
    }

    if (this.children.has(child.name))
      throw new Error(`child named "${child.name}" already exists`)

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

  getSubRecord(name: string): SceneGraph | undefined {
    return this.children.get(name)
  }

  /**
   * if the record does not already cover the given
   * absolute extents, extend it to cover them
   *
   * @param left -
   * @param right -
   * @param top -
   * @param bottom -
   */
  expand(
    newLeft: number,
    newRight: number,
    newTop: number,
    newBottom: number,
  ): void {
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
    if (this.parent) this.parent.expand(newLeft, newRight, newTop, newBottom)
    this.absoluteCache.dirty = true
  }

  get bottom(): number {
    return this.top + this.height
  }

  get right(): number {
    return this.left + this.width
  }

  walkParents(callback: Function): void {
    if (this.parent) {
      callback(this.parent)
      this.parent.walkParents(callback)
    }
  }

  walkChildren(callback: Function): void {
    for (const sub of this.children.values()) {
      callback(sub)
      sub.walkChildren(callback)
    }
  }

  get absolute(): AbsoluteCache {
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

  move(x: number, y: number): void {
    this.left += x
    this.top += y

    this.absoluteCache.dirty = true
    this.walkChildren((c: SceneGraph) => {
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
