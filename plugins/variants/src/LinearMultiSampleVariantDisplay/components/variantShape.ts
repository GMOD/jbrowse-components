// The glyph vocabulary the `shapeType` lane speaks, generated from
// `shaders/variant.slang` (adr-051) rather than declared here and kept in sync
// with it by hand — 0 is a plain rect and any other value is the inversion
// glyph, and the fragment stage tests against the same `SHAPE_RECT`. Re-exported
// so this module stays the one place the shapes are read from.
import {
  SHAPE_RECT,
  SHAPE_TRI_LEFT,
} from './shaders/variant.consts.generated.ts'

export { SHAPE_RECT, SHAPE_TRI_LEFT }

// The glyph a record's cells paint as. An inversion is symmetric — either
// inverted or not, and VCF never sets a strand on a variant record — so one
// triangle covers it. Everything else, insertions included, is the plain
// full-height cell every other genotype draws.
//
// Geometry encodes orientation only, so this stays a fixed rule rather than an
// `encoding.shape` channel. A row-height insertion caret was prototyped and
// declined (2026-10-30): any glyph wider than its record's reference span reads
// as genomic size on x, and common insertions walled every carrier row, as
// 5c22930ba6's marker had. Type, size and carrier share are the records band's
// (ADR-254).
export function shapeTypeOf(featureType: string) {
  return featureType === 'inversion' ? SHAPE_TRI_LEFT : SHAPE_RECT
}

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
// a left-pointing triangle spanning the cell (see `inversionCoverage` in the
// shader); an inversion is symmetric (either inverted or not, no meaningful
// left/right orientation, and VCF never sets a strand on variant records) so it
// needs a single glyph.
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
