// Does the pileup's one `walk` paint at the speed of the painter it replaced?
// `pileupShape` paints a block through it, and `ink` and `hitNearest` place one
// instance through it.
//
//   node --no-use-osr plugins/alignments/benches/rectWalker.bench.ts --size=1m
//
// Flags: --size=100k|1m (one per process), --rounds=<n> (default 25)
//
// ARMS, for the deletion and mismatch marks:
//
//   hand          the painter `walk` replaced, copied verbatim
//   control       a separately declared copy of hand
//   pileupShared  production `pileupShape`'s painter
//
// pileupShape's painters are closures of one function literal, so every arm is
// also warmed with the other non-point pileup marks: skip, overlap,
// perBaseQuality and modification. Every call before the timed rounds is a
// forward block on the counting stub, and OSR is off, for the reason
// `packages/render-core/benches/placeWalkers.bench.ts` gives.
//
// IDENTITY. After timing and before anything prints, every arm and the
// production mark are recorded through `recordingContext` — rects plus every
// fillStyle, strokeStyle and lineWidth write, in order — in both orientations,
// and must match hand exactly. Every timed run is also checked against the
// production mark's counts and coordinate sum.
//
// WHAT IT SAYS. Three processes at 1M, AC, load 0.7-2.1, controls 0.99-1.01x:
// pileupShared paints deletion at 0.82-0.85x of hand and mismatch at
// 0.98-1.02x, and read 0.84-0.85x and 1.00-1.01x over two processes at load
// 3.1-5.1 after the walk moved from alignments' own `bpToScreenX` to
// `projectBp` over render-core's `bpProjection`, which the hand arms keep
// verbatim. `walk` is a loop because a placement call per instance does not
// fit TurboFan's inlining budget: one process each at 1M, AC, load 2.0-2.7,
// controls 0.93-1.01x, `place(c, frame, i, out)` read 1.20x on deletion and
// 1.32x on mismatch, and `placeRow`, `placeFade` and `placeX` 1.22x and 1.12x.
// `place` is 811 bytes of bytecode against the 460 any callee may be, and
// `placeFade` at 436 + 391 never inlines, because a callee's bytecode spends
// the 920-byte cumulative budget and the same statements in the loop body do
// not. The loop has no slack either: the retired `spanRectPx` inlined at 103
// bytes indexed and not at 245 destructured, and with one `frequencyFade` call
// site per rule rather than one for the four rules that fade by frequency,
// `qualityFade` fell out of the budget and mismatch read 1.09x.
//
// THE SPAN'S TWO EDGES ARE SCALAR TWINS, NOT A TUPLE. Three sequential
// processes each at 1M, AC, load about 1, controls 0.99-1.02x, deletion
// against hand: `spanRectPx` over the `float2` twin's tuple 0.83-0.85x;
// `spanRectLeftPx` plus `spanRectWidthPx` over the scalar twins 0.81-0.83x;
// the same arithmetic written into the loop 0.78-0.79x, which is the inlining
// budget spending the two calls. Mismatch, a cell, reads 1.00-1.03x under all
// three. The same walk written in MoonBit and compiled to JS, with every array
// read and context write an extern, matched hand exactly in both orientations
// and read 0.79-0.80x on deletion and 1.03-1.06x on mismatch: the tuple it
// never allocated was its whole margin.
//
// The 0.03 the two twin calls still cost is the walk's own bytecode against
// the inlining budget, not the twins' shape or the wrappers' — three
// sequential processes each: the generated twins hand-rewritten as one
// ternary each read 0.80-0.83x, and the walk calling the twins directly
// with `Math.max` inline, no `spanRectLeftPx`/`WidthPx`, read 0.82-0.83x.
// Nor is it the `keys` read site going polymorphic between the `Uint8Array`
// marks and modification's `Uint32Array`: with every warm fixture's keys a
// `Uint8Array` it read 0.81-0.82x and 0.99-1.02x, unchanged.
//
// WHAT THE COUNTING STUB CANNOT SEE, and is not pursued because Canvas2D is
// the fallback: a real context parses every `fillStyle` string. On a
// mismatch-shaped fixture of 100K cells, half faded to a random alpha, in
// headless Chrome on software raster with a control at 0.99x, one fillStyle
// for the whole paint read 0.49x of the production spelling, the faded alpha
// quantized to 1/255 and its string memoized per (colour, step) 0.83x,
// skipping a write of the style already set 0.84x, and the instances ordered
// by colour then step 0.56x. node-canvas read 0.88x and 0.52x for the
// memoized and single-style arms at 1M. Ordering by colour in the worker is
// out regardless: the mismatch arrays are position-sorted for
// `positionIndex.ts` and `coverageDownsampling.ts` to binary-search.

import { execSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'

import { insertionSizeAlpha } from '@jbrowse/alignments-core'
import { makeCellLeftMapper } from '@jbrowse/render-core/canvas2dUtils'
import { abgrToCssRgba } from '@jbrowse/render-core/marks/colorFill'
import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'

import {
  rgb255,
  rgba255,
  rgbaPrefix255,
} from '../src/LinearAlignmentsDisplay/colorUtils.ts'
import {
  insertionBarWidth,
  LONG_INSERTION_MIN_LENGTH,
} from '../src/LinearAlignmentsDisplay/constants.ts'
import {
  frequencyFade,
  intronAlpha,
  pileupCellWidth,
  pileupRowOffCanvas,
  pileupRowY,
  sizeAlpha,
} from '../src/LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { DELETION_MARK, packGaps } from '../src/features/gap/mark.ts'
import {
  buildBaseCssMap,
  buildBaseFadeCssMap,
} from '../src/features/mismatch/baseColors.ts'
import { MISMATCH_MARK } from '../src/features/mismatch/mark.ts'
import { qualityRampCss } from '../src/features/perBaseQuality/colors.ts'
import {
  Band,
  Fade,
  Hit,
  Paint,
  Point,
  markSelects,
  pileupShape,
} from '../src/features/pileupShape.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../src/shaders/slang/gap.consts.generated.ts'
import * as gapShader from '../src/shaders/slang/gap.generated.ts'
import { qualityFade } from '../src/shaders/slang/mismatch.js.generated.ts'
import {
  overlapAlpha,
  overlapFade,
} from '../src/shaders/slang/overlap.js.generated.ts'

import type { RenderState } from '../src/LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type {
  PileupChannels,
  PileupShapeSpec,
} from '../src/features/pileupShape.ts'
import type { MarkContext2D, MarkFrame } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

class CountingContext implements MarkContext2D {
  fills = 0
  styles = 0
  strokes = 0
  paths = 0
  sum = 0
  style: MarkContext2D['fillStyle'] = ''
  strokeStyle: MarkContext2D['strokeStyle'] = ''
  lineWidth = 1
  get fillStyle() {
    return this.style
  }
  set fillStyle(v: MarkContext2D['fillStyle']) {
    this.style = v
    this.styles++
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.fills++
    this.sum += x + y + w + h
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    this.strokes++
    this.sum += x + y + w + h
  }
  moveTo(x: number, y: number) {
    this.sum += x + y
  }
  lineTo(x: number, y: number) {
    this.sum += x + y
  }
  fill() {
    this.paths++
  }
  save() {}
  restore() {}
  beginPath() {}
  rect() {}
  clip() {}
  translate() {}
  scale() {}
  rotate() {}
  bezierCurveTo() {}
  arc() {}
  ellipse() {}
  setLineDash() {}
  closePath() {}
  stroke() {}
}

type PileupPaintSpec = Pick<
  PileupShapeSpec,
  'pivot' | 'fade' | 'band' | 'contiguous' | 'point' | 'paint' | 'decorate'
>

const CLIP_BAR_WIDTH_PX = 1

function pointWidthPx(
  point: number,
  c: PileupChannels,
  index: number,
  pxPerBp: number,
  featureHeight: number,
) {
  return point === Point.insertionBar
    ? insertionBarWidth(c.lengths![index]!, pxPerBp, featureHeight)
    : CLIP_BAR_WIDTH_PX
}

function pileupHand(spec: PileupPaintSpec) {
  const { pivot, fade, band, contiguous, point, decorate } = spec
  const paintTables = spec.paint
  const centerline = band === Band.centerline
  return {
    paintBlock(
      ctx: MarkContext2D,
      c: PileupChannels,
      block: RenderBlock,
      _frame: MarkFrame,
      state: RenderState,
    ) {
      const { positions, stride, rows, kinds, kind, freqs, quals, lengths } = c
      const { keys, end } = c
      const { rule: paintRule, opaqueCss, fadedCss } = paintTables(state)
      const bpLength = block.end - block.start
      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const featureHeight = state.featureHeight
      const mismatchAlpha = state.mismatchAlpha
      const chainMode = state.chainMode
      const constantAlpha =
        fade === Fade.intron ? intronAlpha(featureHeight) : 1
      const pxPerBp = fullBlockWidth / bpLength
      const bandOffset = centerline ? featureHeight / 2 - 0.5 : 0
      const bandHeight = centerline ? 1 : featureHeight
      const constantCss =
        keys === undefined && (fade === Fade.opaque || fade === Fade.intron)
          ? constantAlpha >= 1
            ? opaqueCss[0]!
            : `${fadedCss[0]!}${constantAlpha})`
          : undefined
      if (constantCss !== undefined) {
        ctx.fillStyle = constantCss
      }
      let lastKey = -1
      let lastCss = ''
      const cell =
        pivot === 'cell'
          ? makePileupCellMapper(block, bpLength, fullBlockWidth, contiguous)
          : undefined
      for (let i = c.start; i < end; i++) {
        if (markSelects(kinds, kind, i)) {
          const rowY = pileupRowY(rows[i]!, state)
          if (!pileupRowOffCanvas(rowY, state)) {
            const offset = i * stride
            const startBp = positions[offset]!
            const widthPx =
              point === undefined
                ? ((stride === 2 ? positions[offset + 1]! : startBp + 1) -
                    startBp) *
                  pxPerBp
                : pointWidthPx(point, c, i, pxPerBp, featureHeight)
            let alpha = constantAlpha
            switch (fade) {
              case Fade.opaque:
              case Fade.intron: {
                break
              }
              case Fade.spanFrequencySize: {
                alpha =
                  frequencyFade(state, widthPx * widthPx, freqs![i]!) *
                  sizeAlpha(widthPx)
                break
              }
              case Fade.cellFrequencyQuality: {
                alpha =
                  frequencyFade(state, widthPx, freqs![i]!) *
                  qualityFade(quals![i]!, mismatchAlpha)
                break
              }
              case Fade.overlap: {
                alpha = chainMode ? overlapFade(widthPx) : overlapAlpha(widthPx)
                break
              }
              case Fade.insertion: {
                const length = lengths![i]!
                alpha =
                  (length >= LONG_INSERTION_MIN_LENGTH
                    ? 1
                    : frequencyFade(state, pxPerBp * pxPerBp, freqs![i]!)) *
                  insertionSizeAlpha(length, pxPerBp)
                break
              }
              case Fade.pointFrequency: {
                alpha = frequencyFade(state, pxPerBp, freqs![i]!)
                break
              }
            }
            if (alpha > 0) {
              if (constantCss === undefined) {
                const key = keys === undefined ? 0 : keys[i]!
                if (paintRule === Paint.packedAbgr) {
                  if (key !== lastKey) {
                    lastKey = key
                    lastCss = abgrToCssRgba(key)
                  }
                  ctx.fillStyle = lastCss
                } else {
                  ctx.fillStyle =
                    alpha >= 1 ? opaqueCss[key]! : `${fadedCss[key]!}${alpha})`
                }
              }
              const top = rowY + bandOffset
              if (point !== undefined) {
                const x = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
                ctx.fillRect(x - widthPx / 2, top, widthPx, bandHeight)
                decorate?.draw(ctx, x, top, bandHeight, c, i, pxPerBp)
              } else if (cell !== undefined) {
                ctx.fillRect(cell.cellX(startBp), top, cell.w, bandHeight)
              } else {
                const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
                const x2 = bpToScreenX(
                  positions[offset + 1]!,
                  block,
                  bpLength,
                  fullBlockWidth,
                )
                const lo = x1 < x2 ? x1 : x2
                const hi = x1 < x2 ? x2 : x1
                fillSpanRect(ctx, lo, hi, top, bandHeight)
              }
            }
          }
        }
      }
    },
  }
}

function pileupControl(spec: PileupPaintSpec) {
  const { pivot, fade, band, contiguous, point, decorate } = spec
  const paintTables = spec.paint
  const centerline = band === Band.centerline
  return {
    paintBlock(
      ctx: MarkContext2D,
      c: PileupChannels,
      block: RenderBlock,
      _frame: MarkFrame,
      state: RenderState,
    ) {
      const { positions, stride, rows, kinds, kind, freqs, quals, lengths } = c
      const { keys, end } = c
      const { rule: paintRule, opaqueCss, fadedCss } = paintTables(state)
      const bpLength = block.end - block.start
      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const featureHeight = state.featureHeight
      const mismatchAlpha = state.mismatchAlpha
      const chainMode = state.chainMode
      const constantAlpha =
        fade === Fade.intron ? intronAlpha(featureHeight) : 1
      const pxPerBp = fullBlockWidth / bpLength
      const bandOffset = centerline ? featureHeight / 2 - 0.5 : 0
      const bandHeight = centerline ? 1 : featureHeight
      const constantCss =
        keys === undefined && (fade === Fade.opaque || fade === Fade.intron)
          ? constantAlpha >= 1
            ? opaqueCss[0]!
            : `${fadedCss[0]!}${constantAlpha})`
          : undefined
      if (constantCss !== undefined) {
        ctx.fillStyle = constantCss
      }
      let lastKey = -1
      let lastCss = ''
      const cell =
        pivot === 'cell'
          ? makePileupCellMapper(block, bpLength, fullBlockWidth, contiguous)
          : undefined
      for (let i = c.start; i < end; i++) {
        if (markSelects(kinds, kind, i)) {
          const rowY = pileupRowY(rows[i]!, state)
          if (!pileupRowOffCanvas(rowY, state)) {
            const offset = i * stride
            const startBp = positions[offset]!
            const widthPx =
              point === undefined
                ? ((stride === 2 ? positions[offset + 1]! : startBp + 1) -
                    startBp) *
                  pxPerBp
                : pointWidthPx(point, c, i, pxPerBp, featureHeight)
            let alpha = constantAlpha
            switch (fade) {
              case Fade.opaque:
              case Fade.intron: {
                break
              }
              case Fade.spanFrequencySize: {
                alpha =
                  frequencyFade(state, widthPx * widthPx, freqs![i]!) *
                  sizeAlpha(widthPx)
                break
              }
              case Fade.cellFrequencyQuality: {
                alpha =
                  frequencyFade(state, widthPx, freqs![i]!) *
                  qualityFade(quals![i]!, mismatchAlpha)
                break
              }
              case Fade.overlap: {
                alpha = chainMode ? overlapFade(widthPx) : overlapAlpha(widthPx)
                break
              }
              case Fade.insertion: {
                const length = lengths![i]!
                alpha =
                  (length >= LONG_INSERTION_MIN_LENGTH
                    ? 1
                    : frequencyFade(state, pxPerBp * pxPerBp, freqs![i]!)) *
                  insertionSizeAlpha(length, pxPerBp)
                break
              }
              case Fade.pointFrequency: {
                alpha = frequencyFade(state, pxPerBp, freqs![i]!)
                break
              }
            }
            if (alpha > 0) {
              if (constantCss === undefined) {
                const key = keys === undefined ? 0 : keys[i]!
                if (paintRule === Paint.packedAbgr) {
                  if (key !== lastKey) {
                    lastKey = key
                    lastCss = abgrToCssRgba(key)
                  }
                  ctx.fillStyle = lastCss
                } else {
                  ctx.fillStyle =
                    alpha >= 1 ? opaqueCss[key]! : `${fadedCss[key]!}${alpha})`
                }
              }
              const top = rowY + bandOffset
              if (point !== undefined) {
                const x = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
                ctx.fillRect(x - widthPx / 2, top, widthPx, bandHeight)
                decorate?.draw(ctx, x, top, bandHeight, c, i, pxPerBp)
              } else if (cell !== undefined) {
                ctx.fillRect(cell.cellX(startBp), top, cell.w, bandHeight)
              } else {
                const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
                const x2 = bpToScreenX(
                  positions[offset + 1]!,
                  block,
                  bpLength,
                  fullBlockWidth,
                )
                const lo = x1 < x2 ? x1 : x2
                const hi = x1 < x2 ? x2 : x1
                fillSpanRect(ctx, lo, hi, top, bandHeight)
              }
            }
          }
        }
      }
    },
  }
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const FRAME = { canvasWidth: 1600, canvasHeight: 1000 }
const PALETTE = Uint32Array.of(
  0xff3355cc,
  0xff22aa44,
  0xffcc8811,
  0xff884499,
  0xff1177ee,
  0xff999999,
  0xff0044aa,
  0xffee2266,
)

function blocksOf(start: number, bpLength: number) {
  const forward: RenderBlock = {
    displayedRegionIndex: 0,
    start,
    end: start + bpLength,
    screenStartPx: 0,
    screenEndPx: FRAME.canvasWidth,
    reversed: false,
  }
  return { forward, reversed: { ...forward, reversed: true } }
}

function runs(rand: () => number, n: number, meanRun: number) {
  const out = new Uint32Array(n)
  let pick = 0
  for (let i = 0; i < n; i++) {
    if (rand() < 1 / meanRun) {
      pick = Math.floor(rand() * PALETTE.length)
    }
    out[i] = PALETTE[pick]!
  }
  return out
}

function geometric(rand: () => number, mean: number) {
  return Math.floor(-Math.log(1 - rand()) * mean)
}

const PILEUP_BP = 6400

function pileupState(): RenderState {
  return {
    featureHeight: 7,
    featureSpacing: 0,
    pileupTopOffset: 0,
    scrollTop: 0,
    canvasWidth: FRAME.canvasWidth,
    canvasHeight: FRAME.canvasHeight,
    mismatchAlpha: false,
    filterMismatchesByFrequency: true,
    chainMode: true,
    showMismatches: true,
    showModifications: false,
    colors: {
      colorDeletion: [0.5, 0.5, 0.5],
      colorSkip: [0, 0, 1],
      colorOverlap: [0.3, 0.3, 0.3],
      colorOverlapTint: [0, 0, 0],
      colorBaseA: [0, 0.8, 0],
      colorBaseC: [0, 0, 0.9],
      colorBaseG: [0.9, 0.6, 0],
      colorBaseT: [0.9, 0, 0],
      colorBaseN: [0.5, 0.4, 0.3],
      colorMutedSnpBase: [0.6, 0.6, 0.6],
    },
  } as unknown as RenderState
}

const DELETION_SPEC: PileupPaintSpec = {
  pivot: 'span',
  fade: Fade.spanFrequencySize,
  band: Band.row,
  contiguous: false,
  paint: state => ({
    rule: Paint.palette,
    opaqueCss: [rgb255(state.colors.colorDeletion)],
    fadedCss: [rgbaPrefix255(state.colors.colorDeletion)],
  }),
}

const MISMATCH_SPEC: PileupPaintSpec = {
  pivot: 'cell',
  fade: Fade.cellFrequencyQuality,
  band: Band.row,
  contiguous: false,
  paint: state => ({
    rule: Paint.palette,
    opaqueCss: buildBaseCssMap(state),
    fadedCss: buildBaseFadeCssMap(state),
  }),
}

const SKIP_SPEC: PileupPaintSpec = {
  pivot: 'span',
  fade: Fade.intron,
  band: Band.centerline,
  contiguous: false,
  paint: state => ({
    rule: Paint.palette,
    opaqueCss: [rgba255(state.colors.colorSkip, 1)],
    fadedCss: [rgbaPrefix255(state.colors.colorSkip)],
  }),
}

const OVERLAP_SPEC: PileupPaintSpec = {
  pivot: 'span',
  fade: Fade.overlap,
  band: Band.row,
  contiguous: false,
  paint: state => {
    const tint = state.chainMode
      ? state.colors.colorOverlap
      : state.colors.colorOverlapTint
    return {
      rule: Paint.palette,
      opaqueCss: [rgb255(tint)],
      fadedCss: [rgbaPrefix255(tint)],
    }
  },
}

const QUALITY_SPEC: PileupPaintSpec = {
  pivot: 'cell',
  fade: Fade.opaque,
  band: Band.row,
  contiguous: true,
  paint: () => ({
    rule: Paint.palette,
    opaqueCss: qualityRampCss,
    fadedCss: [],
  }),
}

const MODIFICATION_SPEC: PileupPaintSpec = {
  pivot: 'cell',
  fade: Fade.opaque,
  band: Band.row,
  contiguous: false,
  paint: () => ({ rule: Paint.packedAbgr, opaqueCss: [], fadedCss: [] }),
}

function sharedPileupPainter(spec: PileupPaintSpec) {
  return pileupShape({
    ...spec,
    id: 'bench',
    mod: gapShader,
    pack: packGaps,
    hit: Hit.always,
  }).paintBlock
}

function pileupChannels(
  fields: Pick<PileupChannels, 'positions' | 'stride' | 'rows'> &
    Partial<PileupChannels>,
): PileupChannels {
  return {
    positions: fields.positions,
    stride: fields.stride,
    rows: fields.rows,
    start: 0,
    end: fields.rows.length,
    kinds: fields.kinds,
    kind: fields.kind ?? 0,
    freqs: fields.freqs,
    quals: fields.quals,
    lengths: undefined,
    keys: fields.keys,
  }
}

function gapFixture(n: number) {
  const rand = rng(23)
  const { forward, reversed } = blocksOf(30_000_000, PILEUP_BP)
  const gapPositions = new Uint32Array(n * 2)
  const gapYs = new Uint16Array(n)
  const gapTypes = new Uint8Array(n)
  const gapFrequencies = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const deletion = rand() < 0.8
    const start = forward.start + Math.floor(rand() * PILEUP_BP)
    gapPositions[i * 2] = start
    gapPositions[i * 2 + 1] =
      start +
      (deletion ? 1 + geometric(rand, 3) : 50 + Math.floor(rand() * 2000))
    gapYs[i] = Math.floor(rand() * 160)
    gapTypes[i] = deletion ? GAP_DELETION : GAP_SKIP
    gapFrequencies[i] = deletion
      ? rand() < 0.7
        ? 255
        : Math.floor(rand() * 255)
      : 0
  }
  const region = { gapPositions, gapYs, gapTypes, gapFrequencies }
  const channels = (kind: number) =>
    pileupChannels({
      positions: gapPositions,
      stride: 2,
      rows: gapYs,
      kinds: gapTypes,
      kind,
      freqs: gapFrequencies,
    })
  return { region, channels, forward, reversed }
}

function mismatchFixture(n: number) {
  const rand = rng(37)
  const { forward, reversed } = blocksOf(30_000_000, PILEUP_BP)
  const bases = [65, 67, 71, 84]
  const mismatchPositions = new Uint32Array(n)
  const mismatchYs = new Uint16Array(n)
  const mismatchBases = new Uint8Array(n)
  const mismatchFrequencies = new Uint8Array(n)
  const mismatchQuals = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    mismatchPositions[i] = forward.start + Math.floor(rand() * PILEUP_BP)
    mismatchYs[i] = Math.floor(rand() * 160)
    mismatchBases[i] = rand() < 0.01 ? 78 : bases[Math.floor(rand() * 4)]!
    mismatchFrequencies[i] = rand() < 0.5 ? 255 : 3 + Math.floor(rand() * 60)
    mismatchQuals[i] = 10 + Math.floor(rand() * 50)
  }
  const region = {
    mismatchPositions,
    mismatchYs,
    mismatchBases,
    mismatchFrequencies,
    mismatchQuals,
  }
  const channels = pileupChannels({
    positions: mismatchPositions,
    stride: 1,
    rows: mismatchYs,
    freqs: mismatchFrequencies,
    quals: mismatchQuals,
    keys: mismatchBases,
  })
  return { region, channels, forward, reversed }
}

function pileupWarmFixtures(n: number) {
  const rand = rng(41)
  const { forward } = blocksOf(30_000_000, PILEUP_BP)
  const cellPositions = Uint32Array.from(
    { length: n },
    () => forward.start + Math.floor(rand() * PILEUP_BP),
  )
  const cellRows = Uint16Array.from({ length: n }, () =>
    Math.floor(rand() * 160),
  )
  const spans = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const start = forward.start + Math.floor(rand() * PILEUP_BP)
    spans[i * 2] = start
    spans[i * 2 + 1] = start + 1 + Math.floor(rand() * 400)
  }
  const gapTypes = new Uint8Array(n).fill(GAP_SKIP)
  return [
    {
      spec: SKIP_SPEC,
      channels: pileupChannels({
        positions: spans,
        stride: 2,
        rows: cellRows,
        kinds: gapTypes,
        kind: GAP_SKIP,
        freqs: new Uint8Array(n),
      }),
    },
    {
      spec: OVERLAP_SPEC,
      channels: pileupChannels({ positions: spans, stride: 2, rows: cellRows }),
    },
    {
      spec: QUALITY_SPEC,
      channels: pileupChannels({
        positions: cellPositions,
        stride: 1,
        rows: cellRows,
        keys: Uint8Array.from({ length: n }, () => Math.floor(rand() * 60)),
      }),
    },
    {
      spec: MODIFICATION_SPEC,
      channels: pileupChannels({
        positions: cellPositions,
        stride: 1,
        rows: cellRows,
        keys: runs(rand, n, 30),
      }),
    },
  ]
}

// The projection and cell mapper the hand painters were copied with, verbatim.
// Production projects through render-core's `bpProjection`, which reaches the
// same px by a different rounding on a reversed block.
function bpToScreenX(
  absBp: number,
  block: RenderBlock,
  bpLength: number,
  fullBlockWidth: number,
) {
  const bpEdge = block.reversed ? block.end : block.start
  const offset = block.reversed ? bpEdge - absBp : absBp - bpEdge
  return block.screenStartPx + (offset / bpLength) * fullBlockWidth
}

function makePileupCellMapper(
  block: RenderBlock,
  bpLength: number,
  fullBlockWidth: number,
  contiguous: boolean,
) {
  return {
    w: pileupCellWidth(bpLength / fullBlockWidth, contiguous),
    cellX: makeCellLeftMapper({
      start: block.start,
      end: block.start + bpLength,
      screenStartPx: block.screenStartPx,
      screenEndPx: block.screenStartPx + fullBlockWidth,
      reversed: block.reversed,
    }),
  }
}

// The `fillSpanRect` the hand painters were copied with, verbatim: two tuples
// per span, the `float2` twin's and `spanRectPx`'s, which production no longer
// allocates.
function expandToMinWidthPx(
  x1: number,
  x2: number,
  minWidth: number,
): [number, number] {
  if (x2 - x1 < minWidth) {
    const mid = (x1 + x2) * 0.5
    const half = minWidth * 0.5
    return [mid - half, mid + half]
  }
  return [x1, x2]
}

function spanRectPx(px: number, px2: number, widthCompensation = 0) {
  const edges = expandToMinWidthPx(px, px2, 1)
  return [
    edges[0],
    Math.max(px2 - px + widthCompensation, edges[1] - edges[0]),
  ] as const
}

function fillSpanRect(
  ctx: MarkContext2D,
  px: number,
  px2: number,
  top: number,
  height: number,
  widthCompensation = 0,
) {
  const [left, width] = spanRectPx(px, px2, widthCompensation)
  ctx.fillRect(left, top, width, height)
}

const PX_EPS = 1e-9

type Painter = (ctx: MarkContext2D, block: RenderBlock) => void

interface Shape {
  name: string
  entries: number
  forward: RenderBlock
  reversed: RenderBlock
  reference: Painter
  arms: { name: string; paint: Painter }[]
}

function paintWith<C, F, P>(
  paint: (
    ctx: MarkContext2D,
    channels: C,
    block: RenderBlock,
    frame: F,
    params: P,
  ) => void,
  channels: C,
  frame: F,
  params: P,
): Painter {
  return (ctx, block) => {
    paint(ctx, channels, block, frame, params)
  }
}

function pileupArms(
  spec: PileupPaintSpec,
  channels: PileupChannels,
  state: RenderState,
) {
  return [
    {
      name: 'hand',
      paint: paintWith(pileupHand(spec).paintBlock, channels, state, state),
    },
    {
      name: 'control',
      paint: paintWith(pileupControl(spec).paintBlock, channels, state, state),
    },
    {
      name: 'pileupShared',
      paint: paintWith(sharedPileupPainter(spec), channels, state, state),
    },
  ]
}

interface Recording {
  calls: ReturnType<typeof recordingContext>['calls']
  styles: string[]
}

class StyleLog implements MarkContext2D {
  readonly inner = recordingContext()
  readonly styles: string[] = []
  get fillStyle() {
    return this.inner.ctx.fillStyle
  }
  set fillStyle(v: MarkContext2D['fillStyle']) {
    const style = String(v)
    this.styles.push(`fill ${style}`)
    this.inner.ctx.fillStyle = style
  }
  get strokeStyle() {
    return this.inner.ctx.strokeStyle
  }
  set strokeStyle(v: MarkContext2D['strokeStyle']) {
    const style = String(v)
    this.styles.push(`stroke ${style}`)
    this.inner.ctx.strokeStyle = style
  }
  get lineWidth() {
    return this.inner.ctx.lineWidth
  }
  set lineWidth(v: number) {
    this.styles.push(`lineWidth ${v}`)
    this.inner.ctx.lineWidth = v
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.inner.ctx.fillRect(x, y, w, h)
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    this.inner.ctx.strokeRect(x, y, w, h)
  }
  rect(x: number, y: number, w: number, h: number) {
    this.inner.ctx.rect(x, y, w, h)
  }
  moveTo(x: number, y: number) {
    this.inner.ctx.moveTo(x, y)
  }
  lineTo(x: number, y: number) {
    this.inner.ctx.lineTo(x, y)
  }
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) {
    this.inner.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
  }
  arc(x: number, y: number, radius: number) {
    this.inner.ctx.arc(x, y, radius)
  }
  ellipse(x: number, y: number, radiusX: number, radiusY: number) {
    this.inner.ctx.ellipse(x, y, radiusX, radiusY)
  }
  beginPath() {
    this.inner.ctx.beginPath()
  }
  closePath() {
    this.inner.ctx.closePath()
  }
  fill() {
    this.inner.ctx.fill()
  }
  stroke() {
    this.inner.ctx.stroke()
  }
  save() {
    this.inner.ctx.save()
  }
  restore() {
    this.inner.ctx.restore()
  }
  translate(x: number, y: number) {
    this.inner.ctx.translate(x, y)
  }
  scale(x: number, y: number) {
    this.inner.ctx.scale(x, y)
  }
  rotate(angle: number) {
    this.inner.ctx.rotate(angle)
  }
  clip() {}
  setLineDash() {}
}

function record(paint: Painter, block: RenderBlock): Recording {
  const log = new StyleLog()
  paint(log, block)
  return { calls: log.inner.calls, styles: log.styles }
}

function firstDifference(a: Recording, b: Recording) {
  if (a.calls.length !== b.calls.length) {
    return `${a.calls.length} rects against ${b.calls.length}`
  }
  for (let i = 0; i < a.calls.length; i++) {
    const p = a.calls[i]!
    const q = b.calls[i]!
    if (
      Math.abs(p.x - q.x) > PX_EPS ||
      p.y !== q.y ||
      Math.abs(p.w - q.w) > PX_EPS ||
      p.h !== q.h ||
      p.fillStyle !== q.fillStyle
    ) {
      return `rect ${i}: ${JSON.stringify(p)} against ${JSON.stringify(q)}`
    }
  }
  if (a.styles.length !== b.styles.length) {
    return `${a.styles.length} style writes against ${b.styles.length}`
  }
  for (let i = 0; i < a.styles.length; i++) {
    if (a.styles[i] !== b.styles[i]) {
      return `style write ${i}: ${a.styles[i]} against ${b.styles[i]}`
    }
  }
  return undefined
}

function sameCounts(a: CountingContext, b: CountingContext) {
  return (
    a.fills === b.fills &&
    a.styles === b.styles &&
    a.strokes === b.strokes &&
    a.paths === b.paths &&
    a.sum === b.sum
  )
}

function exitOnIdentityFailure(shapes: Shape[]) {
  for (const shape of shapes) {
    for (const block of [shape.forward, shape.reversed]) {
      const orientation = block.reversed ? 'reversed' : 'forward'
      const [hand, ...rest] = shape.arms
      const handRecording = record(hand!.paint, block)
      const failures = [
        [
          'the production painter',
          firstDifference(record(shape.reference, block), handRecording),
        ],
        ...rest.map(arm => [
          arm.name,
          firstDifference(handRecording, record(arm.paint, block)),
        ]),
      ]
      for (const [against, diff] of failures) {
        if (diff) {
          console.error(
            `IDENTITY FAIL ${shape.name} ${shape.entries} ${orientation}: ${against} against hand: ${diff}`,
          )
          process.exit(1)
        }
      }
    }
  }
}

function buildShapes(n: number, state: RenderState) {
  const gaps = gapFixture(n)
  const mismatches = mismatchFixture(n)
  const shapes: Shape[] = [
    {
      name: 'deletion',
      entries: n,
      forward: gaps.forward,
      reversed: gaps.reversed,
      reference: (ctx, block) => {
        DELETION_MARK.paintBlock(ctx, gaps.region, block, state)
      },
      arms: pileupArms(DELETION_SPEC, gaps.channels(GAP_DELETION), state),
    },
    {
      name: 'mismatch',
      entries: n,
      forward: mismatches.forward,
      reversed: mismatches.reversed,
      reference: (ctx, block) => {
        MISMATCH_MARK.paintBlock(ctx, mismatches.region, block, state)
      },
      arms: pileupArms(MISMATCH_SPEC, mismatches.channels, state),
    },
  ]

  const warmers = pileupWarmFixtures(Math.min(n, 20_000)).flatMap(
    ({ spec, channels }) =>
      pileupArms(spec, channels, state).map(arm => arm.paint),
  )

  return { shapes, warmers, pileupBlocks: gaps }
}

function warm(built: ReturnType<typeof buildShapes>, times: number) {
  for (let w = 0; w < times; w++) {
    for (const shape of built.shapes) {
      for (const arm of shape.arms) {
        arm.paint(new CountingContext(), shape.forward)
      }
    }
    for (const warmer of built.warmers) {
      warmer(new CountingContext(), built.pileupBlocks.forward)
    }
  }
}

function main() {
  const arg = (name: string) =>
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
  const size = arg('size') ?? '100k'
  const n = size === '1m' ? 1_000_000 : size === '100k' ? 100_000 : Number.NaN
  if (Number.isNaN(n)) {
    console.error('--size=100k or --size=1m')
    process.exit(1)
  }
  const rounds = Number(arg('rounds') ?? 25)

  const state = pileupState()
  const built = buildShapes(n, state)
  const { shapes } = built

  warm(buildShapes(2_000, state), 300)
  warm(built, 3)

  const expected = shapes.map(shape => {
    const signature = new CountingContext()
    shape.reference(signature, shape.forward)
    return signature
  })

  const best = shapes.map(shape => shape.arms.map(() => Infinity))
  for (let r = 0; r < rounds; r++) {
    for (let s = 0; s < shapes.length; s++) {
      const shapeIndex = (r + s) % shapes.length
      const shape = shapes[shapeIndex]!
      const { arms } = shape
      for (let k = 0; k < arms.length; k++) {
        const armIndex = (r + k) % arms.length
        const ctx = new CountingContext()
        const t0 = performance.now()
        arms[armIndex]!.paint(ctx, shape.forward)
        const ms = performance.now() - t0
        if (!sameCounts(ctx, expected[shapeIndex]!)) {
          console.error(
            `TIMED RUN DIFFERS ${shape.name} ${arms[armIndex]!.name} in round ${r}`,
          )
          process.exit(1)
        }
        best[shapeIndex]![armIndex] = Math.min(best[shapeIndex]![armIndex]!, ms)
      }
    }
  }

  exitOnIdentityFailure(shapes)

  const power = execSync('cat /sys/class/power_supply/AC*/online')
    .toString()
    .trim()
  const uptime = execSync('uptime').toString().trim()
  const load1 = Number(/load average: ([\d.]+)/.exec(uptime)?.[1])
  const provisional = power !== '1' || !(load1 <= 6)
  console.log(`AC online: ${power}`)
  console.log(uptime)
  console.log(
    `${provisional ? 'PROVISIONAL: ' : ''}--size=${size}, ${rounds} interleaved rounds, min per arm`,
  )
  console.log(
    'identity: every arm matches hand and hand the production painter, both orientations',
  )
  console.log('')
  console.log(
    `${'shape'.padEnd(10)}${'entries'.padStart(9)}${'painted'.padStart(9)}${'styles'.padStart(9)}${'hand'.padStart(20)}${shapes[0]!.arms
      .slice(1)
      .map(arm => arm.name.padStart(14))
      .join('')}`,
  )
  for (const [s, shape] of shapes.entries()) {
    const want = expected[s]!
    const [hand, ...rest] = best[s]!
    const cells = rest.map(ms => `${(ms / hand!).toFixed(2)}x`.padStart(14))
    const handCell = `${hand!.toFixed(2)}ms ${((hand! / shape.entries) * 1e6).toFixed(1)}ns`
    console.log(
      `${shape.name.padEnd(10)}${String(shape.entries).padStart(9)}${String(want.fills + want.paths).padStart(9)}${String(want.styles).padStart(9)}${handCell.padStart(20)}${cells.join('')}`,
    )
  }
}

main()
