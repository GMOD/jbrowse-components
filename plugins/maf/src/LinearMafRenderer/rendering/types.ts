export const FONT_CONFIG = 'bold 10px Courier New,monospace'
export const CHAR_SIZE_WIDTH = 10
export const GAP_STROKE_OFFSET = 0.4
export const INSERTION_LINE_WIDTH = 1
export const INSERTION_BORDER_WIDTH = 2
export const INSERTION_PADDING = 2
export const VERTICAL_TEXT_OFFSET = 3
export const LARGE_INSERTION_THRESHOLD = 10
export const HIGH_ZOOM_THRESHOLD = 0.2
export const MIN_ROW_HEIGHT_FOR_BORDERS = 5
export const HIGH_BP_PER_PX_THRESHOLD = 10
export const INSERTION_BORDER_HEIGHT = 5

export interface RenderingContext {
  ctx: CanvasRenderingContext2D
  scale: number
  bpPerPx: number
  canvasWidth: number
  rowHeight: number
  h: number
  offset: number
  colorForBase: Record<string, string>
  showAllLetters: boolean
  mismatchRendering: boolean
  charHeight: number
}
