// What a mark list pays to write the SAME uniform struct once per mark.
//
//   node packages/render-core/benches/markUniformDedupe.bench.ts --fixture=coverage --blocks=8
//   node packages/render-core/benches/markUniformDedupe.bench.ts --fixture=glyph --blocks=8
//
// Flags: --fixture=coverage|glyph (required), --blocks=<n>, --rounds=<n>,
// --reps=<n>.
//
// The harness rules (interleave, min-of-rounds, a separately-declared control,
// an identity check before any timing is believed) are in
// agent-docs/reference/BENCHMARKING.md. ONE FIXTURE AND ONE BLOCK COUNT PER
// PROCESS, for the reason that file gives: arm function objects reused across
// fixtures contaminate every fixture after the first.
//
// THE QUESTION. `defineMark`'s `drawRegion` calls `shape.writeUniforms` then
// `hal.writeUniforms` for every mark of every block of every frame. Two mark
// lists in tree declare five marks over ONE uniform writer and ONE `params`
// lens, so four of the five writes per block restate the same 27 (coverage) or
// 12 (glyph) stores into the same scratch and stage the same bytes again:
//   - alignments-core `coverageBandMarks` — `writeBandUniforms`, 112-byte UBO
//   - canvas `featureGlyphMarks` — `writeFeatureGlyphUniforms`, 48-byte UBO
//
// THREE ARMS, one a control:
//   baseline — a hand-copied `drawRegion` as it stood before `StagedUniforms`:
//              every mark packs and stages its own struct
//   current  — the real `defineMark`, imported, which skips both when the
//              previous mark of the same block used the same writer AND the
//              same `params` reference
//   dedupe   — a hand-copied, separately-declared duplicate of `current`, so
//              `dedupe / current` is what this harness could resolve at all
//
// The HAL stub stages the way `WebGPUHal.writeUniforms` does (a `set` into the
// ring's CPU staging array, slot post-incremented), which is the write the
// dedupe removes. `drawPass` is a counter — identical in every arm, so it
// cannot move the delta, and the delta is the whole answer here.
//
// Written out longhand, three times. Do NOT refactor the drivers or the
// `defineMark` copies into one parameterized function: a shared driver makes
// the call site polymorphic and hands all arms one set of inline caches, which
// has scored a byte-identical control at 1.14x in this repo's sibling benches.

import {
  arrowShape,
  continuationShape,
  lineShape,
  makeChevronShape,
  rectShape,
} from '../../../plugins/canvas/src/LinearBasicDisplay/marks/featureGlyphShapes.ts'
import {
  coverageBarShape,
  coverageIndicatorShape,
  coverageInterbaseShape,
  coverageModShape,
  coverageSnpShape,
} from '../../alignments-core/src/coverageBandMarks.ts'
import { clipBlock } from '../src/blockClipUtils.ts'
import { devicePxBand } from '../src/canvas2dUtils.ts'
import { defineMark } from '../src/marks/types.ts'

import type { FeatureGlyphParams } from '../../../plugins/canvas/src/LinearBasicDisplay/marks/featureGlyphShapes.ts'
import type {
  CoverageBandParams,
  CoverageBandRegion,
  CoverageBandState,
} from '../../alignments-core/src/coverageBandMarks.ts'
import type { BlockClipResult } from '../src/blockClipUtils.ts'
import type { GpuHal } from '../src/hal/types.ts'
import type {
  Mark,
  MarkBand,
  MarkFrame,
  MarkShape,
} from '../src/marks/types.ts'
import type { RenderBlock } from '../src/renderBlock.ts'

const arg = (name: string, dflt: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt

const FIXTURE = arg('fixture', '')
const BLOCKS = Number(arg('blocks', '8'))
const ROUNDS = Number(arg('rounds', '25'))
const REPS = Number(arg('reps', '400'))

if (FIXTURE !== 'coverage' && FIXTURE !== 'glyph') {
  console.error('--fixture=coverage or --fixture=glyph')
  process.exit(1)
}

const UNIFORM_SLOT_BYTES = 256
const RING_SLOTS = 4096

/** Shaped like `WebGPUHal.writeUniforms`'s in-frame path. */
class TimingHal {
  staging = new Uint8Array(RING_SLOTS * UNIFORM_SLOT_BYTES)
  slot = 0
  writes = 0
  draws = 0
  writeUniforms(data: ArrayBuffer) {
    this.staging.set(new Uint8Array(data), this.slot * UNIFORM_SLOT_BYTES)
    this.slot++
    this.writes++
  }
  drawPass() {
    this.draws++
  }
  setScissor() {}
}

interface Reuse {
  writer: unknown
  params: unknown
}

interface ArmMark<TRegion, TState extends MarkFrame> extends Omit<
  Mark<TRegion, TState>,
  'drawRegion'
> {
  drawRegion(
    hal: GpuHal,
    scratch: ArrayBuffer,
    block: RenderBlock,
    clip: BlockClipResult,
    region: TRegion,
    state: TState,
    regionKey: number,
    reuse?: Reuse,
  ): void
}

interface ArmSpec<TRegion, TState extends MarkFrame, TChannels, TParams> {
  shape: MarkShape<TChannels, TParams>
  channels: (region: TRegion) => TChannels
  params: (state: TState, region: TRegion) => TParams
  bufferOf?: Mark<TRegion, TState>
  band?: (state: TState) => MarkBand
}

// --- arm "baseline": `drawRegion` as it stood before `StagedUniforms`. The
// duplication is deliberate; see the header.
function defineBaseline<TRegion, TState extends MarkFrame, TChannels, TParams>(
  spec: ArmSpec<TRegion, TState, TChannels, TParams>,
): Mark<TRegion, TState> {
  const { shape, channels, params, band } = spec
  const bufferOf = spec.bufferOf?.pass.id
  return {
    pass: { ...shape.pass, pack: region => shape.pass.pack(channels(region)) },
    bufferOf,
    paintBlock() {},
    drawRegion(hal, scratch, block, clip, region, state, regionKey) {
      const strip = band?.(state)
      const scissor = strip
        ? devicePxBand(strip.top, strip.height, clip.scaleY, clip.pxH)
        : undefined
      if (scissor && scissor.height === 0) {
        return
      }
      const p = params(state, region)
      if (shape.paintsBlock && !shape.paintsBlock(block, state, p)) {
        return
      }
      if (scissor) {
        hal.setScissor(clip.pxX, scissor.top, clip.pxW, scissor.height)
      }
      shape.writeUniforms(scratch, clip, block, state, p)
      hal.writeUniforms(scratch)
      hal.drawPass(shape.pass.id, regionKey, bufferOf)
      if (scissor) {
        hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      }
    },
  }
}

// --- arm "current": the real `defineMark`, imported, with no wrapper of its
// own — an extra call layer on one arm alone is a structural advantage the
// bench must not hand out.
function defineCurrent<TRegion, TState extends MarkFrame, TChannels, TParams>(
  spec: ArmSpec<TRegion, TState, TChannels, TParams>,
): Mark<TRegion, TState> {
  return defineMark(spec)
}

// --- arm "dedupe": a second, separately-declared copy of what `current` does,
// so its ratio against `current` is this harness's own resolution.
function defineDedupe<TRegion, TState extends MarkFrame, TChannels, TParams>(
  spec: ArmSpec<TRegion, TState, TChannels, TParams>,
): ArmMark<TRegion, TState> {
  const { shape, channels, params, band } = spec
  const bufferOf = spec.bufferOf?.pass.id
  return {
    pass: { ...shape.pass, pack: region => shape.pass.pack(channels(region)) },
    bufferOf,
    paintBlock() {},
    drawRegion(hal, scratch, block, clip, region, state, regionKey, reuse) {
      const strip = band?.(state)
      const scissor = strip
        ? devicePxBand(strip.top, strip.height, clip.scaleY, clip.pxH)
        : undefined
      if (scissor && scissor.height === 0) {
        return
      }
      const p = params(state, region)
      if (shape.paintsBlock && !shape.paintsBlock(block, state, p)) {
        return
      }
      if (scissor) {
        hal.setScissor(clip.pxX, scissor.top, clip.pxW, scissor.height)
      }
      if (reuse?.writer !== shape.writeUniforms || reuse.params !== params) {
        shape.writeUniforms(scratch, clip, block, state, p)
        hal.writeUniforms(scratch)
        if (reuse) {
          reuse.writer = shape.writeUniforms
          reuse.params = params
        }
      }
      hal.drawPass(shape.pass.id, regionKey, bufferOf)
      if (scissor) {
        hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      }
    },
  }
}

// ---------------------------------------------------------------- fixtures

globalThis.devicePixelRatio = 2

const CANVAS_W = 1600
const CANVAS_H = 400
const SCALE = { x: 2, y: 2 }

const BLOCK_LIST: RenderBlock[] = []
for (let i = 0; i < BLOCKS; i++) {
  const width = CANVAS_W / BLOCKS
  BLOCK_LIST.push({
    displayedRegionIndex: i,
    start: 1_000_000 + i * 20_000,
    end: 1_000_000 + (i + 1) * 20_000,
    screenStartPx: i * width,
    screenEndPx: (i + 1) * width,
    reversed: i % 4 === 3,
  })
}
const CLIPS = BLOCK_LIST.map(b => clipBlock(b, CANVAS_W, CANVAS_H, SCALE)!)

interface CovState extends MarkFrame {
  band: CoverageBandState
}
type CovRegion = CoverageBandRegion & { modCovPackedBuffer: ArrayBuffer }

const COV_REGION: CovRegion = {
  coveragePackedBuffer: new ArrayBuffer(8 * 2000),
  snpPackedBuffer: new ArrayBuffer(16 * 400),
  modCovPackedBuffer: new ArrayBuffer(16 * 200),
  interbasePackedBuffer: new ArrayBuffer(16 * 300),
  indicatorPackedBuffer: new ArrayBuffer(8 * 120),
  coverageMaxDepth: 87,
  coverageBinSize: 1,
  interbaseMaxCount: 34,
}
const COV_STATE: CovState = {
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
  band: {
    height: 120,
    top: 0,
    domainMin: 0,
    domainMax: 87,
    scaleType: 0,
    symlogConstant: 1,
    snpMinFrequency: 0,
    showInterbase: true,
    colors: {
      coverage: 0xff888888,
      baseA: 0xff00c800,
      baseC: 0xffc80000,
      baseG: 0xff0000c8,
      baseT: 0xff00c8c8,
      baseN: 0xff646464,
      insertionIndicator: 0xffc800c8,
      softclipIndicator: 0xff0064c8,
      hardclipIndicator: 0xff000000,
    },
  },
}
// what alignments-core's `bandParams` builds, restated so each arm gets its
// own lens reference
const covParams =
  () =>
  (s: CovState, r: CovRegion): CoverageBandParams => ({
    ...s.band,
    regionMaxDepth: r.coverageMaxDepth,
    coverageBinSize: r.coverageBinSize,
    interbaseMaxCount: r.interbaseMaxCount,
  })
const covBand = () => (s: CovState) => ({ top: 0, height: s.band.height })

interface GlyphState extends MarkFrame {
  scrollY: number
  outlineColor: number
}
const N = 3000
const GLYPH_REGION = {
  linePositions: new Uint32Array(N * 2),
  lineYs: new Float32Array(N),
  lineHeights: new Float32Array(N),
  lineDirections: new Int8Array(N),
  lineColors: new Uint32Array(N),
  rectPositions: new Uint32Array(N * 2),
  rectYs: new Float32Array(N),
  rectHeights: new Float32Array(N),
  rectColors: new Uint32Array(N),
  rectDensityFade: new Uint32Array(N),
  rectStrands: new Float32Array(N),
  arrowXs: new Uint32Array(N),
  arrowYs: new Float32Array(N),
  arrowHeights: new Float32Array(N),
  arrowWidthsBp: new Uint32Array(N),
  arrowDirections: new Int8Array(N),
  arrowColors: new Uint32Array(N),
}
type GlyphRegion = typeof GLYPH_REGION
const GLYPH_STATE: GlyphState = {
  canvasWidth: CANVAS_W,
  canvasHeight: CANVAS_H,
  scrollY: 40,
  outlineColor: 0xff333333,
}
const glyphParams =
  () =>
  (s: GlyphState): FeatureGlyphParams => ({
    scrollY: s.scrollY,
    outlineColor: s.outlineColor,
  })

const lineLens = (d: GlyphRegion) => ({
  startEnd: d.linePositions,
  y: d.lineYs,
  height: d.lineHeights,
  direction: d.lineDirections,
  color: d.lineColors,
  count: d.lineYs.length,
})
const rectLens = (d: GlyphRegion) => ({
  startEnd: d.rectPositions,
  y: d.rectYs,
  height: d.rectHeights,
  color: d.rectColors,
  densityFade: d.rectDensityFade,
  strand: d.rectStrands,
  count: d.rectYs.length,
})
const arrowLens = (d: GlyphRegion) => ({
  x: d.arrowXs,
  y: d.arrowYs,
  height: d.arrowHeights,
  widthBp: d.arrowWidthsBp,
  direction: d.arrowDirections,
  color: d.arrowColors,
  count: d.arrowYs.length,
})
const CHEVRON_SHAPE = makeChevronShape(20)

// --------------------------------------------------------------- mark lists

function covList(
  make: <TC>(
    spec: ArmSpec<CovRegion, CovState, TC, CoverageBandParams> & {
      channels: (region: CovRegion) => TC
    },
  ) => ArmMark<CovRegion, CovState>,
) {
  const params = covParams()
  const band = covBand()
  const channels = (r: CovRegion) => r
  return [
    make({ shape: coverageBarShape, channels, params, band }),
    make({ shape: coverageSnpShape, channels, params, band }),
    make({ shape: coverageModShape, channels, params, band }),
    make({ shape: coverageInterbaseShape, channels, params, band }),
    make({ shape: coverageIndicatorShape, channels, params, band }),
  ]
}

function glyphList(
  make: <TC>(
    spec: ArmSpec<GlyphRegion, GlyphState, TC, FeatureGlyphParams> & {
      channels: (region: GlyphRegion) => TC
    },
  ) => ArmMark<GlyphRegion, GlyphState>,
) {
  const params = glyphParams()
  const line = make({ shape: lineShape, channels: lineLens, params })
  const rect = make({ shape: rectShape, channels: rectLens, params })
  return [
    line,
    make({
      shape: CHEVRON_SHAPE,
      channels: lineLens,
      params,
      bufferOf: line,
    }),
    rect,
    make({ shape: arrowShape, channels: arrowLens, params }),
    make({
      shape: continuationShape,
      channels: rectLens,
      params,
      bufferOf: rect,
    }),
  ]
}

const REGION = FIXTURE === 'coverage' ? COV_REGION : GLYPH_REGION
const STATE = FIXTURE === 'coverage' ? COV_STATE : GLYPH_STATE
const SCRATCH = new ArrayBuffer(UNIFORM_SLOT_BYTES)

type Arm = ArmMark<typeof REGION, typeof STATE>

// One fixture per process, so exactly one branch of the region/state union is
// live and the marks of the other are never constructed with it.
const asArm = (m: unknown) => m as Arm
const CURRENT: Arm[] = (
  FIXTURE === 'coverage' ? covList(defineCurrent) : glyphList(defineCurrent)
).map(asArm)
const DEDUPE: Arm[] = (
  FIXTURE === 'coverage' ? covList(defineDedupe) : glyphList(defineDedupe)
).map(asArm)
const BASELINE: Arm[] = (
  FIXTURE === 'coverage' ? covList(defineBaseline) : glyphList(defineBaseline)
).map(asArm)

// ------------------------------------------------------------------ drivers
// Three separate function literals on purpose — see the header.

function runCurrent(hal: TimingHal, reps: number) {
  const reuse: Reuse = { writer: undefined, params: undefined }
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      const clip = CLIPS[b]!
      reuse.writer = undefined
      reuse.params = undefined
      for (const mark of CURRENT) {
        mark.drawRegion(
          hal as unknown as GpuHal,
          SCRATCH,
          block,
          clip,
          REGION,
          STATE,
          block.displayedRegionIndex,
          reuse,
        )
      }
    }
  }
}

function runDedupe(hal: TimingHal, reps: number) {
  const reuse: Reuse = { writer: undefined, params: undefined }
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      const clip = CLIPS[b]!
      reuse.writer = undefined
      reuse.params = undefined
      for (const mark of DEDUPE) {
        mark.drawRegion(
          hal as unknown as GpuHal,
          SCRATCH,
          block,
          clip,
          REGION,
          STATE,
          block.displayedRegionIndex,
          reuse,
        )
      }
    }
  }
}

function runBaseline(hal: TimingHal, reps: number) {
  for (let r = 0; r < reps; r++) {
    hal.slot = 0
    for (let b = 0; b < BLOCK_LIST.length; b++) {
      const block = BLOCK_LIST[b]!
      const clip = CLIPS[b]!
      for (const mark of BASELINE) {
        mark.drawRegion(
          hal as unknown as GpuHal,
          SCRATCH,
          block,
          clip,
          REGION,
          STATE,
          block.displayedRegionIndex,
        )
      }
    }
  }
}

// ---------------------------------------------------- identity + call counts

function stageAll(marks: Arm[]) {
  const staged: string[] = []
  const local: Reuse = { writer: undefined, params: undefined }
  let writes = 0
  let inForce = ''
  const recorder = {
    writeUniforms(data: ArrayBuffer) {
      writes++
      inForce = [...new Uint8Array(data)].join(',')
    },
    drawPass(passId: string, key: number, bufferPassId?: string) {
      staged.push(`${passId}/${key}/${bufferPassId ?? '-'}/${inForce}`)
    },
    setScissor() {},
  }
  for (let b = 0; b < BLOCK_LIST.length; b++) {
    const block = BLOCK_LIST[b]!
    const clip = CLIPS[b]!
    local.writer = undefined
    local.params = undefined
    for (const mark of marks) {
      mark.drawRegion(
        recorder as unknown as GpuHal,
        SCRATCH,
        block,
        clip,
        REGION,
        STATE,
        block.displayedRegionIndex,
        local,
      )
    }
  }
  return { staged, writes }
}

const currentRun = stageAll(CURRENT)
const dedupeRun = stageAll(DEDUPE)
const baselineRun = stageAll(BASELINE)

const same = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

// The bytes each draw binds, not the number of writes: an arm staging fewer
// times has to bind the same values or it is not the same picture.
for (const [name, run] of [
  ['dedupe', dedupeRun],
  ['current', currentRun],
] as const) {
  if (!same(baselineRun.staged, run.staged)) {
    const i = baselineRun.staged.findIndex((v, j) => v !== run.staged[j])
    console.error(
      `IDENTITY FAIL at draw ${i}:\n  baseline ${baselineRun.staged[i]}\n  ${name} ${run.staged[i]}`,
    )
    process.exit(1)
  }
}

console.log(
  `fixture=${FIXTURE} blocks=${BLOCKS} marks=${CURRENT.length} rounds=${ROUNDS} reps=${REPS}`,
)
console.log(
  `draws/frame ${baselineRun.staged.length}  uniform writes/frame: baseline ${baselineRun.writes}, current ${currentRun.writes} (saved ${baselineRun.writes - currentRun.writes})`,
)

// -------------------------------------------------------------------- timing

const halA = new TimingHal()
const halB = new TimingHal()
const halC = new TimingHal()

// warm every arm the same way
runCurrent(halA, 200)
runDedupe(halB, 200)
runBaseline(halC, 200)

let minCurrent = Infinity
let minDedupe = Infinity
let minBaseline = Infinity
// The arms rotate position within the round, so no arm always runs first (or
// always inherits the one before it).
for (let round = 0; round < ROUNDS; round++) {
  for (let slot = 0; slot < 3; slot++) {
    const t = Number(process.hrtime.bigint())
    if ((round + slot) % 3 === 0) {
      runCurrent(halA, REPS)
      minCurrent = Math.min(minCurrent, Number(process.hrtime.bigint()) - t)
    } else if ((round + slot) % 3 === 1) {
      runDedupe(halB, REPS)
      minDedupe = Math.min(minDedupe, Number(process.hrtime.bigint()) - t)
    } else {
      runBaseline(halC, REPS)
      minBaseline = Math.min(minBaseline, Number(process.hrtime.bigint()) - t)
    }
  }
}

const usPerFrame = (ns: number) => ns / REPS / 1000
const cur = usPerFrame(minCurrent)
const ded = usPerFrame(minDedupe)
const base = usPerFrame(minBaseline)

console.log('')
console.log('arm        us/frame   ratio vs baseline')
console.log(`baseline   ${base.toFixed(3).padStart(8)}   1.00x`)
console.log(
  `current    ${cur.toFixed(3).padStart(8)}   ${(base / cur).toFixed(2)}x`,
)
console.log(
  `dedupe     ${ded.toFixed(3).padStart(8)}   ${(base / ded).toFixed(2)}x`,
)
console.log('')
console.log(
  `saving ${(base - cur).toFixed(3)} us/frame (current vs its own control ${Math.abs(cur - ded).toFixed(3)} us/frame, ${(ded / cur).toFixed(2)}x)`,
)
