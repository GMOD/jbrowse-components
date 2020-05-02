export type RectTuple = [number, number, number, number]
export interface SerializedLayout {
  rectangles: Record<string, RectTuple>
  totalHeight: number
  maxHeightReached: boolean
}
export interface Rectangle<T> {
  id: string
  l: number
  r: number
  top: number | null
  h: number
  originalHeight: number
  data?: Record<string, T>
}

export interface BaseLayout<T> {
  addRect(
    id: string,
    left: number,
    right: number,
    height: number,
    data: Record<string, T>,
  ): number | null
  collides(rect: Rectangle<T>, top: number): boolean
  addRectToBitmap(rect: Rectangle<T>, data: Record<string, T>): void
  getRectangles(): Map<string, RectTuple>
  discardRange(left: number, right: number): void
  serializeRegion(region: { start: number; end: number }): SerializedLayout
  getTotalHeight(): number
  maxHeightReached: boolean
  toJSON(): SerializedLayout
}
