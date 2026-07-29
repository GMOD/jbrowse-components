import type { BpRegionBounds } from './renderBlock.ts'

export interface BlockClip {
  scissorX: number
  scissorW: number
  fullBlockWidth: number
  bpLength: number
}

// Ceiling on the ratio we render at. Cost scales with the square: a dpr=3 phone
// would allocate 9x the pixels of dpr=1 and shade 9x the fragments, for a
// difference essentially nobody resolves past 2x. Retina (2) is the target and
// is unaffected; only dpr>2 devices are capped.
//
// It also buys headroom against MAX_CANVAS_DIM_PX: a canvas has to reach 4096
// CSS px on an axis to clamp now, instead of 2731 at dpr=3.
export const MAX_DPR = 2

/**
 * The ratio every canvas in the app renders at, capped at {@link MAX_DPR}.
 *
 * Use this, never a bare `devicePixelRatio` read — the value has to agree
 * across the backing-store sizing (`syncCanvasSize` / `prepareCanvas`), the
 * scissor/viewport rects derived from it (`clipBlock`, alignments'
 * `computeBlockGeom`), and any shader uniform that reconstructs backing-store
 * dimensions from CSS ones. A call site that reads the global directly renders
 * geometry at a different scale than the canvas it lands on.
 *
 * Two places legitimately want something other than this and should keep saying
 * so explicitly: `createSvgRasterCanvas` pins 2x because export goes to a file
 * rather than a screen, and the analytics / error-report paths read the raw
 * global because they are reporting the device, not drawing on it.
 */
export function getDpr() {
  return typeof devicePixelRatio === 'undefined'
    ? 1
    : Math.min(devicePixelRatio, MAX_DPR)
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
// clamp engages).
//
// This is a last-resort guard against `InvalidStateError: Canvas exceeds max
// size`, NOT a graceful degradation: once clamped the backing store stops
// tracking the CSS size, so the browser *stretches* the smaller image over the
// larger element, and every GPU scissor/viewport rect — computed as
// `cssPx * getDpr()` by `clipBlock` and friends, against the true dpr rather
// than the effective one — can now exceed the backing store (WebGL clamps
// silently, WebGPU rejects the rect and blanks the frame). So model-level
// sizing must keep canvases within the limit on its own; MAF's `maxRowsHeight`
// (`MAX_CANVAS_DIM_PX / getDpr()`) is the pattern to copy for any display that
// sizes a canvas to its *content* rather than its viewport. Registered in
// agent-docs/reference/ARCHITECTURAL_LIMITS.md with the effective-dpr fix that
// retires it.
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
  }
  // CSS size is set independently of `changed`: once a dimension clamps to
  // MAX_CANVAS_DIM_PX the backing store stops tracking the CSS size, so gating
  // the style write on the backing store froze the element at whatever CSS size
  // it had when it first clamped. Assigning the same string is a no-op in the
  // browser, so this costs nothing on the common path.
  const cssWidth = `${width}px`
  const cssHeight = `${height}px`
  if (canvas.style.width !== cssWidth) {
    canvas.style.width = cssWidth
  }
  if (canvas.style.height !== cssHeight) {
    canvas.style.height = cssHeight
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
// (see agent-docs/reference/GPU_RENDERING.md "Canvas scaling & hi-DPI").
// Returning the
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
  const fullBlockWidth = block.screenEndPx - block.screenStartPx
  const bpLength = block.end - block.start
  // Degenerate blocks are skipped, matching `clipBlock` on the GPU side —
  // callers divide by both of these, and clampBlockScissor alone lets a
  // zero-span block through (floor/ceil widen it to one column).
  return clamp && fullBlockWidth > 0 && bpLength > 0
    ? {
        scissorX: clamp.scissorX,
        scissorW: clamp.scissorW,
        fullBlockWidth,
        bpLength,
      }
    : null
}

/**
 * The 2D-context subset the block scaffold below needs. Structural on purpose:
 * render-core must not depend on `@jbrowse/core`, where the real `Ctx2D =
 * CanvasRenderingContext2D | SvgCanvas` union lives. Both members satisfy it,
 * so a plugin passes its `Ctx2D` straight in.
 */
export interface ClipContext2D {
  save(): void
  restore(): void
  beginPath(): void
  rect(x: number, y: number, w: number, h: number): void
  clip(): void
}

/**
 * The Canvas2D twin of `GpuPerRegionRenderingBackend.renderBlocks`' per-block
 * scissor: skip blocks with nothing to draw or no on-screen span, clip to the
 * block's columns, paint, unclip. Owning it here means a painter can't pair
 * `save()` with a missed `restore()` (leaking the clip onto every later block),
 * clip to a span other than `clipBlockForCanvas`', or forget the null check.
 *
 * `select` resolves a block to what it paints, or `undefined` to skip it — the
 * one gate covering all three reasons a painter skips: no region in the map, a
 * region with zero features, and a region whose relevant sub-field is absent
 * (MAF's `?.coverage`). It runs *before* the clip because entering the scaffold
 * for an empty block is not free on the export path: `SvgCanvas.clip()` emits a
 * `<clipPath>` + group unconditionally, so a skipped-late block leaves dead
 * markup in the SVG. Resolving here also lets `paint` take a non-optional value
 * instead of re-narrowing inside the callback.
 *
 * `clipHeight` is a parameter rather than read off a render state because
 * painters that own a sub-band of the canvas clip to that band, not the full
 * height (MAF's coverage row).
 *
 * `paint` receives the block, so callers needing bp→px build their own mapper
 * (`makeBpMapper` / `makeCellLeftMapper` — which one is a per-painter choice).
 * Two closures per draw call, not per feature: per-feature loops live inside the
 * `paint` body and stay allocation-free.
 */
export function forEachClippedBlock<T, B extends BpRegionBounds>(
  ctx: ClipContext2D,
  blocks: readonly B[],
  canvasWidth: number,
  clipHeight: number,
  select: (block: B) => T | undefined,
  paint: (data: T, block: B, clip: BlockClip) => void,
) {
  for (const block of blocks) {
    const data = select(block)
    const clip =
      data === undefined ? null : clipBlockForCanvas(block, canvasWidth)
    if (data !== undefined && clip) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(clip.scissorX, 0, clip.scissorW, clipHeight)
      ctx.clip()
      try {
        paint(data, block, clip)
      } finally {
        // An on-screen ctx outlives the frame and `prepareCanvas`'s
        // setTransform/clearRect do not reset clip state, so a painter that
        // throws once would otherwise leave every later frame drawing through
        // a stale clip — a transient error turned permanent corruption.
        ctx.restore()
      }
    }
  }
}

/**
 * `fillRect` x for a mark that spans `x1`→`x2` but is painted at `width` — the
 * Canvas2D pivot for every painter that widens a too-narrow span to a floor (a
 * 1bp feature, a zoomed-out coverage bin), and the twin of the pivot baked into
 * the shaders' `extendToMinWidthX`.
 *
 * The mark is anchored at `x1` and grows *away* from it. That's the whole point:
 * on a reversed block `makeBpMapper` flips, so `x2 < x1`, `x1` is the feature's
 * **start** — its right edge — and the mark must grow leftward from it. Spelling
 * the fill as `min(x1, x2)` + `max(floor, |dx|)` instead anchors whichever edge
 * happens to be leftmost, which reversed is the feature's *end*, sliding the
 * mark by up to the floor. Forward blocks are identical either way, so the error
 * only ever shows on flipped regions and survives review. The canvas rect
 * painter (2px floor), the multi-row painter (1px), and wiggle (1.5px) each had
 * it independently.
 *
 * Callers own the *width*, like `makeCellLeftMapper` below — it's a per-plugin
 * rule (canvas/multi-row take `max(floor, |dx|)`, matching `extendToMinWidthX`
 * exactly; wiggle adds a seam-closing fudge the shader deliberately omits).
 * Only the pivot is shared, and it's the part that keeps being got wrong.
 *
 * Scalar in, scalar out: runs per feature per frame, so it must not allocate.
 */
export function spanLeft(x1: number, x2: number, width: number) {
  return x2 < x1 ? x1 - width : x1
}

// Quantize a 0..1 ramp position to a 256-entry index. Shared so the direct
// lookup and the fillStyle LUT below can't quantize differently — a half-step
// of drift between them shows up as a one-shade mismatch between a cell's fill
// and the alpha read off the same ramp.
function rampIndex(t: number) {
  return Math.max(0, Math.min(255, Math.round(t * 255)))
}

export function lookupColorRamp(ramp: Uint8Array, t: number) {
  const idx = rampIndex(t) * 4
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
    const idx = rampIndex(t)
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

/**
 * Fill the rect covering genomic `[startBp, endBp)`, given a bare
 * `makeBpMapper`. Maps **both** edges and takes the leftmost, which is
 * orientation-safe by construction: on a reversed block bp runs leftward, so
 * the span's left edge is its *end*, and there is no pivot to get backwards.
 *
 * Prefer this to `makeCellLeftMapper` + a caller-computed width for anything
 * wider than one base. The pivot in `makeCellLeftMapper` is exactly one base,
 * which is right for a 1bp cell and silently wrong for an N-bp span — it
 * anchors the rect one base from the correct edge and then grows it the wrong
 * way. `fillBpSpan(bp, bp + 1)` is *identical* to the cell-mapper spelling, so
 * a per-base painter can use this too and never think about orientation again.
 *
 * `seam` is the caller's sub-pixel overlap (MAF's `GAP_STROKE_OFFSET`), added
 * to the width so adjacent cells don't show hairlines at ~1px/bp. Widening a
 * sub-pixel *feature* to a visible floor is a different job — that's
 * `spanLeft`, which must anchor the feature's start edge.
 */
export function fillBpSpan(
  ctx: { fillRect: (x: number, y: number, w: number, h: number) => void },
  toX: (bp: number) => number,
  startBp: number,
  endBp: number,
  top: number,
  height: number,
  seam = 0,
) {
  const x1 = toX(startBp)
  const x2 = toX(endBp)
  ctx.fillRect(Math.min(x1, x2), top, Math.abs(x2 - x1) + seam, height)
}

/**
 * The **integer base** whose 1bp cell covers screen pixel `px` — the inverse of
 * `makeCellLeftMapper`, for hit-testing (which base did the cursor land on) as
 * opposed to painting.
 *
 * Rounding is not `Math.floor` on both orientations, which is the trap. The
 * un-rounded inverse of `makeBpMapper` lands in `[b, b+1)` on a forward block
 * but in `(b, b+1]` on a reversed one, because bp runs leftward there — so
 * flooring reversed names `b+1` on base `b`'s leftmost pixel column, and names
 * `end` (outside the block) on the block's first column. It is the same
 * one-base pivot `makeCellLeftMapper` exists to get right, seen from the other
 * direction, and it fails the same way: invisible zoomed out, a whole base off
 * at base zoom, and only on flipped regions.
 *
 * Callers own the *range* check: a `px` outside `[screenStartPx, screenEndPx)`
 * extrapolates rather than clamping, since which block owns a pixel is the
 * caller's decision (adjacent blocks share an edge pixel).
 */
export function bpAtPx(px: number, bounds: BpRegionBounds) {
  const { start, end, screenStartPx, screenEndPx, reversed } = bounds
  const frac = (px - screenStartPx) / (screenEndPx - screenStartPx)
  const span = end - start
  return reversed
    ? Math.ceil(end - frac * span) - 1
    : Math.floor(start + frac * span)
}
