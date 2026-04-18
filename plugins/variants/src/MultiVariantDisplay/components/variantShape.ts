// Shape IDs match the shader switch in `shaders/variant.slang` (fs_main).
// Keep in sync with any changes there.
export const SHAPE_RECT = 0
export const SHAPE_TRI_RIGHT = 1
export const SHAPE_TRI_LEFT = 2
export const SHAPE_TRI_DOWN = 3

// Minimal 2D path sink — both CanvasRenderingContext2D and SvgCanvas match.
// closePath is optional because native Canvas auto-closes on fill; SVG
// serializers need it for correctness.
interface ShapePath {
  fillRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath?(): void
  fill(): void
}

// Draws one variant glyph into `ctx`. Shape 0 is a plain rect; 1/2 are
// horizontal triangles (inversions); 3 is a down-pointing triangle
// (insertions). Degenerate insertions (width < 1 px) fall back to a rect
// so they remain visible at low zoom.
export function drawVariantShape(
  ctx: ShapePath,
  shape: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const effective = shape === SHAPE_TRI_DOWN && w < 1 ? SHAPE_RECT : shape
  if (effective === SHAPE_RECT) {
    ctx.fillRect(x, y, w, h)
  } else if (effective === SHAPE_TRI_RIGHT) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y + h / 2)
    ctx.lineTo(x, y + h)
    ctx.closePath?.()
    ctx.fill()
  } else if (effective === SHAPE_TRI_LEFT) {
    ctx.beginPath()
    ctx.moveTo(x + w, y)
    ctx.lineTo(x, y + h / 2)
    ctx.lineTo(x + w, y + h)
    ctx.closePath?.()
    ctx.fill()
  } else if (effective === SHAPE_TRI_DOWN) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w / 2, y + h)
    ctx.closePath?.()
    ctx.fill()
  }
}
