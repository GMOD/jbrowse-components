export type RectTuple = [number, number, number, number]
export interface SerializedLayout {
  rectangles: Record<string, RectTuple>
  totalHeight: number
  containsNoTransferables: true
  maxHeightReached: boolean
}
export interface Rectangle {
  id: string
  l: number
  r: number
  top: number | null
  h: number
  originalHeight: number
  data?: unknown
}

export interface BaseLayout {
  addRect(
    id: string,
    left: number,
    right: number,
    height: number,
    data?: unknown,
  ): number | null
  collides(rect: Rectangle, top: number): boolean
  addRectToBitmap(rect: Rectangle, data: unknown): void
  getRectangles(): Map<string, RectTuple>
  discardRange(left: number, right: number): void
  serializeRegion(region: { start: number; end: number }): SerializedLayout
  getTotalHeight(): number
  maxHeightReached: boolean
  toJSON(): SerializedLayout
}
