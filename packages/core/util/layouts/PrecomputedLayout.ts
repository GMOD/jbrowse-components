import RBush from 'rbush'
import type {
  RectTuple,
  SerializedLayout,
  BaseLayout,
  Rectangle,
} from './BaseLayout'

export interface Layout {
  minX: number
  minY: number
  maxX: number
  maxY: number
  name: string
}

export default class PrecomputedLayout<T> implements BaseLayout<T> {
  private rectangles: Map<string, RectTuple>

  private totalHeight: number

  public maxHeightReached: boolean

  private rbush: RBush<Layout>

  constructor({ rectangles, totalHeight, maxHeightReached }: SerializedLayout) {
    this.rectangles = new Map(Object.entries(rectangles))
    // rectangles is of the form "featureId": [leftPx, topPx, rightPx, bottomPx]
    this.totalHeight = totalHeight
    this.maxHeightReached = maxHeightReached
    this.rbush = new RBush()
    for (const [key, layout] of Object.entries(rectangles)) {
      this.rbush.insert({
        minX: layout[0],
        minY: layout[1],
        maxX: layout[2],
        maxY: layout[3],
        name: key,
      })
    }
  }

  addRect(id: string) {
    const rect = this.rectangles.get(id)
    if (!rect) {
      throw new Error(`id ${id} not found in precomputed feature layout`)
    }
    // left, top, right, bottom
    return rect[1]
  }

  /**
   * returns a Map of `feature id -> rectangle`
   */
  getRectangles(): Map<string, RectTuple> {
    return this.rectangles
  }

  getTotalHeight(): number {
    return this.totalHeight
  }

  collides(_rect: Rectangle<T>, _top: number): boolean {
    throw new Error('Method not implemented.')
  }

  getByCoord(x: number, y: number) {
    const rect = { minX: x, minY: y, maxX: x + 1, maxY: y + 1 }
    return this.rbush.collides(rect)
      ? this.rbush.search(rect)[0]!.name
      : undefined
  }

  getByID(id: string) {
    return this.rectangles.get(id)
  }

  addRectToBitmap(_rect: Rectangle<T>, _data: Record<string, T>): void {
    throw new Error('Method not implemented.')
  }

  discardRange(_left: number, _right: number): void {
    throw new Error('Method not implemented.')
  }

  serializeRegion(_region: { start: number; end: number }): SerializedLayout {
    throw new Error('Method not implemented.')
  }

  toJSON(): SerializedLayout {
    return {
      rectangles: Object.fromEntries(this.rectangles),
      totalHeight: this.totalHeight,
      maxHeightReached: false,
      containsNoTransferables: true,
    }
  }
}
