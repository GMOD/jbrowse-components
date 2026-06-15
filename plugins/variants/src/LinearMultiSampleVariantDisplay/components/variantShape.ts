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

// --- Insertion glyph: one zoom-driven shape (triangle near / line far) ---
//
// An insertion (SHAPE_TRI_DOWN) is drawn as a down-pointing triangle whose base
// spans the alt-allele / SVLEN width, up to a max of INS_TRI_SPAN_PX. The
// single thing that drives its look is that span measured in *screen px*: wide
// (zoomed in, or a large insertion) → full triangle capped at INS_TRI_SPAN_PX
// wide; narrow (zoomed out, or a point insertion) → thin vertical line. Larger
// insertions keep a wide span longer, so they collapse later, but never grow a
// triangle wider than the cap — the fade is a pure function of on-screen size,
// with no per-feature tuning.
//
// `insertionGlyph` below is the ONE definition of that morph. Two renderers
// consume it and must agree:
//   - Canvas2D / SVG: `drawVariantShape` draws the trapezoid it returns.
//   - GPU: `shaders/variant.slang` can't import TS, so it mirrors these three
//     constants and blends a triangle SDF with a box SDF by `triBlend`. The
//     trapezoid (top/bottom width) and that SDF blend are two encodings of the
//     same morph — edit both together.

// span ≤ this many px → fully collapsed to a line
const INS_LINE_SPAN_PX = 2
// span ≥ this many px → full triangle, and the triangle's base width caps here
// too (so a wide insertion zoomed in stays a small triangle, not a giant one)
const INS_TRI_SPAN_PX = 10
// thickness of the collapsed line, and the minimum visible glyph width
const INS_LINE_WIDTH_PX = 2

// GLSL/WGSL smoothstep, mirrored so the JS and shader fades match exactly.
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

interface InsertionGlyph {
  // 0 = line, 1 = triangle; how far through the morph this insertion is.
  triBlend: number
  // Top edge width in px (triangle base / the line itself).
  topWidthPx: number
  // Bottom edge width in px — shrinks to 0 as triBlend → 1 (the triangle apex).
  bottomWidthPx: number
}

// Resolve an insertion's on-screen span (px) to its morphed glyph geometry.
export function insertionGlyph(spanPx: number): InsertionGlyph {
  const triBlend = smoothstep(INS_LINE_SPAN_PX, INS_TRI_SPAN_PX, spanPx)
  const cappedSpan = Math.min(spanPx, INS_TRI_SPAN_PX)
  const widenToSpan =
    Math.max(cappedSpan, INS_LINE_WIDTH_PX) - INS_LINE_WIDTH_PX
  const topWidthPx = INS_LINE_WIDTH_PX + widenToSpan * triBlend
  const bottomWidthPx = topWidthPx * (1 - triBlend)
  return { triBlend, topWidthPx, bottomWidthPx }
}

// Draws one variant glyph into `ctx`. Shape 0 is a plain rect; 1/2 are
// horizontal triangles (inversions). Shape 3 is an insertion, drawn as the
// triangle↔line trapezoid from `insertionGlyph` and centered on its true span
// (so a point insertion lands on its locus as a thin tick). `spanPx` is the
// unclamped on-screen width of that span; the other shapes ignore it.
export function drawVariantShape(
  ctx: ShapePath,
  shape: number,
  x: number,
  y: number,
  w: number,
  h: number,
  spanPx: number,
) {
  if (shape === SHAPE_RECT) {
    ctx.fillRect(x, y, w, h)
  } else if (shape === SHAPE_TRI_RIGHT) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y + h / 2)
    ctx.lineTo(x, y + h)
    ctx.closePath?.()
    ctx.fill()
  } else if (shape === SHAPE_TRI_LEFT) {
    ctx.beginPath()
    ctx.moveTo(x + w, y)
    ctx.lineTo(x, y + h / 2)
    ctx.lineTo(x + w, y + h)
    ctx.closePath?.()
    ctx.fill()
  } else if (shape === SHAPE_TRI_DOWN) {
    const { topWidthPx, bottomWidthPx } = insertionGlyph(spanPx)
    const center = x + spanPx / 2
    const topHalf = topWidthPx / 2
    const botHalf = bottomWidthPx / 2
    ctx.beginPath()
    ctx.moveTo(center - topHalf, y)
    ctx.lineTo(center + topHalf, y)
    ctx.lineTo(center + botHalf, y + h)
    ctx.lineTo(center - botHalf, y + h)
    ctx.closePath?.()
    ctx.fill()
  }
}
