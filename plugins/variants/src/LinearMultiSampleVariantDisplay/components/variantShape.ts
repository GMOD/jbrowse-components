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

// How far the inversion glyph's point extends from the cell's left edge, in the
// same pixels as `w`/`h`. Capped at the cell height, so the glyph is a cell with
// a pointed left end rather than a wedge spanning the whole call: a full-width
// triangle drawn on a 500px-wide, 2px-tall cell (a 22 Mb <INV> in a per-sample
// lane) covers a linearly growing fraction of each column, which antialiases
// into a left-to-right fade and hides the very thing the cell's width is there
// to show — where the call begins. At `w <= h`, which is every SNP-scale cell,
// `min` returns `w` and the glyph is the same full triangle it always was.
// Mirrored in the shader's `taperPx`; keep the two in sync.
export function variantTaperPx(w: number, h: number) {
  return Math.min(w, h)
}

// Draws one variant glyph into `ctx`. Shape 0 is a plain rect — SNPs,
// insertions, and every ordinary genotype cell. SHAPE_TRI_LEFT is an inversion,
// drawn with a left-pointing tip; an inversion is symmetric (either inverted
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
    const t = variantTaperPx(w, h)
    ctx.beginPath()
    ctx.moveTo(x + w, y)
    ctx.lineTo(x + t, y)
    ctx.lineTo(x, y + h / 2)
    ctx.lineTo(x + t, y + h)
    ctx.lineTo(x + w, y + h)
    ctx.closePath?.()
    ctx.fill()
  }
}
