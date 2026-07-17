import type { BpRegionBounds } from './renderBlock.ts'

export interface BlockClip {
  scissorX: number
  scissorW: number
  fullBlockWidth: number
  bpLength: number
}

export function getDpr() {
  return typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1
}

// Conservative ceiling (physical/backing px) for a single canvas dimension.
// Browsers throw `InvalidStateError: Canvas exceeds max size` once the backing
// store crosses their (browser/GPU-specific) limit — Firefox caps the area,
// WebGL caps a texture at MAX_TEXTURE_SIZE (>= 8192 on essentially all real
// hardware), Safari/Chrome cap the dimension. 8192 is under all of these, so a
// canvas whose backing store stays within it on both axes can't throw. Callers
// that can produce arbitrarily tall/wide content (e.g. the MAF rows canvas with
// hundreds of species) bound their CSS size against `MAX_CANVAS_DIM_PX / dpr`.
export const MAX_CANVAS_DIM_PX = 8192

let warnedCanvasClamp = false

// CSS px → backing-store px, clamped to the safe ceiling (warning once if the
// clamp engages). The model-level sizing (e.g. MAF `rowHeight`) should keep
// canvases within the limit on its own; this is the last-resort guard so a
// pathological size degrades to a clipped canvas instead of a thrown exception.
function backingPx(cssSize: number, dpr: number, axis: 'width' | 'height') {
  const value = Math.round(cssSize * dpr)
  if (value > MAX_CANVAS_DIM_PX) {
    if (!warnedCanvasClamp) {
      warnedCanvasClamp = true
      console.warn(
        `Canvas ${axis} ${value}px exceeds the safe limit ${MAX_CANVAS_DIM_PX}px and was clamped`,
      )
    }
    return MAX_CANVAS_DIM_PX
  }
  return value
}

// Apply CSS dimensions + dpr-scaled physical dimensions to `canvas`. Returns
// whether the backing dimensions actually changed — both HAL impls and any
// 2D-canvas backend use this so the dpr math and style-vs-attribute logic
// live in one place.
export function syncCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): boolean {
  const dpr = getDpr()
  const pw = backingPx(width, dpr, 'width')
  const ph = backingPx(height, dpr, 'height')
  const changed = canvas.width !== pw || canvas.height !== ph
  if (changed) {
    canvas.width = pw
    canvas.height = ph
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
  }
  return changed
}

export function prepareCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
) {
  const dpr = getDpr()
  const bufW = backingPx(canvasWidth, dpr, 'width')
  const bufH = backingPx(canvasHeight, dpr, 'height')

  if (canvas.width !== bufW || canvas.height !== bufH) {
    canvas.width = bufW
    canvas.height = bufH
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
}

// Acquire a DPR-prepared 2D context from a (possibly null) canvas ref, or null
// if the canvas/context isn't available. Bundles the
// `getContext('2d')` + null-guard + `prepareCanvas` ritual that every
// standalone 2D overlay otherwise hand-rolls in its draw effect — and the
// `prepareCanvas` DPR step is easy to omit, which renders blurry on Retina
// (see agent-docs/ARCHITECTURE.md "Canvas scaling & hi-DPI"). Returning the
// prepared ctx structurally prevents that omission.
export function getPreparedCanvas2D(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const ctx = canvas?.getContext('2d')
  if (canvas && ctx) {
    prepareCanvas(canvas, ctx, width, height)
    return ctx
  }
  return null
}

// Convert a CSS-px span [cssStart, cssEnd] to an integer device-px `{ start,
// width }` rect by rounding each edge independently, then subtracting. Rounding
// the *width* (`round((cssEnd-cssStart)*dpr)`) instead can push the right edge
// one px past `round(cssEnd*dpr)`: that overflows the backing store for a span
// touching the canvas edge (WebGPU rejects an out-of-bounds scissor and blanks
// the frame) and opens 1px seams between adjacent spans. Edge-rounding pins the
// right edge to `round(cssEnd*dpr)`, so one span's end always equals the next
// span's start. The single source for every CSS→device-px scissor/viewport span
// (`clipBlock` X, alignments `computeBlockGeom` X / `devBand` Y).
export function devicePxSpan(cssStart: number, cssEnd: number, dpr: number) {
  const start = Math.round(cssStart * dpr)
  return { start, width: Math.round(cssEnd * dpr) - start }
}

// Integer scissor rect (CSS px) for a block clamped to the canvas. Shared by
// the GPU (`clipBlock`) and Canvas2D (`clipBlockForCanvas`) clip paths so both
// backends clip to the exact same pixel columns — the rounding lives in one
// place rather than being copied. Returns null when the block is fully
// off-screen.
export function clampBlockScissor(
  screenStartPx: number,
  screenEndPx: number,
  canvasWidth: number,
) {
  const scissorX = Math.max(0, Math.floor(screenStartPx))
  const scissorEnd = Math.min(canvasWidth, Math.ceil(screenEndPx))
  const scissorW = scissorEnd - scissorX
  return scissorW <= 0 ? null : { scissorX, scissorEnd, scissorW }
}

export function clipBlockForCanvas(
  block: BpRegionBounds,
  canvasWidth: number,
): BlockClip | null {
  const clamp = clampBlockScissor(
    block.screenStartPx,
    block.screenEndPx,
    canvasWidth,
  )
  return clamp
    ? {
        scissorX: clamp.scissorX,
        scissorW: clamp.scissorW,
        fullBlockWidth: block.screenEndPx - block.screenStartPx,
        bpLength: block.end - block.start,
      }
    : null
}

export function lookupColorRamp(ramp: Uint8Array, t: number) {
  const idx = Math.max(0, Math.min(255, Math.round(t * 255))) * 4
  return {
    r: ramp[idx]!,
    g: ramp[idx + 1]!,
    b: ramp[idx + 2]!,
    a: ramp[idx + 3]! / 255,
  }
}

// 256-entry LUT factory for per-cell `rgba(...)` fillStyle strings, keyed by
// the same quantized index as `lookupColorRamp`. Hot loops in HiC/LD allocate
// one fillStyle per cell; with up to 256 unique outputs from a fixed ramp,
// caching brings 7-15x speedup on big matrices. Returned closure is meant to
// live for one draw call.
export function makeRampFillStyleLut(ramp: Uint8Array) {
  const lut: (string | undefined)[] = new Array(256)
  return (t: number) => {
    const idx = Math.max(0, Math.min(255, Math.round(t * 255)))
    let s = lut[idx]
    if (s === undefined) {
      const o = idx * 4
      const a = ramp[o + 3]! / 255
      s = `rgba(${ramp[o]!},${ramp[o + 1]!},${ramp[o + 2]!},${a.toFixed(3)})`
      lut[idx] = s
    }
    return s
  }
}

export function bpToScreenPx(
  absBp: number,
  regionStart: number,
  regionEnd: number,
  screenStartPx: number,
  screenEndPx: number,
  reversed?: boolean,
) {
  const frac = (absBp - regionStart) / (regionEnd - regionStart)
  const w = screenEndPx - screenStartPx
  return reversed ? screenEndPx - frac * w : screenStartPx + frac * w
}

// Closure-style bp→screen-px mapper bound to one region. Consumers that walk
// many bp positions inside one block (label/peptide overlays, rect/line draws)
// want a 1-arg call instead of repeating 6 args at every site.
export function makeBpMapper(bounds: BpRegionBounds) {
  const { start, end, screenStartPx, screenEndPx, reversed } = bounds
  const span = end - start
  const w = screenEndPx - screenStartPx
  return reversed
    ? (bp: number) => screenEndPx - ((bp - start) / span) * w
    : (bp: number) => screenStartPx + ((bp - start) / span) * w
}

/**
 * Left edge of the **1bp cell** covering `bp` — for painters that fill a rect
 * per base (MAF alignment cells, the alignments pileup's mismatch /
 * modification / per-base quality+letter / soft-clip base layers).
 *
 * Use this, not `makeBpMapper`, whenever the mark is a cell rather than a point
 * or a two-edge span. `makeBpMapper(bp)` is the cell's left edge only on a
 * forward block: a reversed block runs bp leftward, so it lands on the cell's
 * *right* edge, and `fillRect(x, y, +w, h)` from there covers bp-1 instead. The
 * error is one base wide — invisible zoomed out (cells floor to ~1px), a whole
 * base off zoomed in, and it only reproduces on flipped regions, so it survives
 * casual review. Every plugin that hand-rolled the pivot had to rediscover it;
 * the alignments pileup got it wrong across all five of its cell layers.
 *
 * Two-edge spans (`min(toX(start), toX(end))`) and boundary marks (insertions,
 * clip bars, centered on a bp edge) are orientation-safe already and don't need
 * this. The GPU side has no equivalent bug — shaders span
 * `bpToClipX(pos)`→`bpToClipX(pos+1)` unflipped and mirror via `flipX` — and
 * gets its own pivot from `writeBpRangeUniforms`.
 *
 * Callers own the cell *width*: it's a per-plugin rule (MAF uses the raw
 * bp-scale; the pileup floors at 1px and adds a seam fudge). Only the pivot is
 * shared.
 */
export function makeCellLeftMapper(bounds: BpRegionBounds) {
  const toX = makeBpMapper(bounds)
  const pxPerBp =
    (bounds.screenEndPx - bounds.screenStartPx) / (bounds.end - bounds.start)
  // One base's signed span: exact for fractional zooms, and one add per cell —
  // these run per base per row, so a second mapper call per cell would show.
  const shift = bounds.reversed ? -pxPerBp : 0
  return (bp: number) => toX(bp) + shift
}
