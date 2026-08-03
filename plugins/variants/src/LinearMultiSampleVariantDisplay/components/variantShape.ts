// Shape IDs match the shader check in `shaders/variant.slang` (fs_main): 0 is a
// plain rect, any non-zero value is the inversion glyph. Keep in sync there.
export const SHAPE_RECT = 0
export const SHAPE_TRI_LEFT = 1

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

// Draws one variant glyph into `ctx`. Shape 0 is a plain rect — SNPs,
// insertions, and every ordinary genotype cell. SHAPE_TRI_LEFT is an inversion,
// drawn as a left-pointing triangle; an inversion is symmetric (either inverted
// or not, no meaningful left/right orientation, and VCF never sets a strand on
// variant records) so it needs a single glyph.
export function drawVariantShape(
  ctx: ShapePath,
  shape: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (shape === SHAPE_RECT) {
    ctx.fillRect(x, y, w, h)
  } else {
    ctx.beginPath()
    ctx.moveTo(x + w, y)
    ctx.lineTo(x, y + h / 2)
    ctx.lineTo(x + w, y + h)
    ctx.closePath?.()
    ctx.fill()
  }
}
