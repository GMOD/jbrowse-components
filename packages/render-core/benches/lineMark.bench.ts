// Does the render-core `line` shape pack and paint at the speed of wiggle's
// hand-written step line and centre line, which it would replace?
//
//   node --no-use-osr packages/render-core/benches/lineMark.bench.ts --size=100k
//   node --no-use-osr packages/render-core/benches/lineMark.bench.ts --size=1m --rounds=25
//
// Flags: --size=100k|1m, --rounds=<n> (default 15). One size per process
// (BENCHMARKING.md, "Looping several DATASETS").
//
// ARMS, each over one block of one source, tiling spans with a hole every
// fiftieth instance:
//
//   pack       retired   wiggle's `packLineInstances`, copied verbatim over
//                        its interleaved positions
//              control   a separately declared copy of retired
//              ported    `lineStepMark.pass.pack` over split x/x2 arrays
//              lens      splitting wiggle's interleaved positions into the
//                        x/x2 the shape reads, which is what wiggle's port
//                        would pay per encode and retain per region
//   step       retired / control / ported `paintBlock`, the step line
//   center     retired / control / ported `paintBlock`, the centre line
//
// Every driver is its own literal, and identity runs AFTER timing: the retired
// painters saw two context shapes when it ran first and read 2x their control.
// Identity: the ported painters must record
// the same point sequence as retired (within 1e-6 px) in both orientations,
// and the ported record must agree with retired's on every field, sentinel
// for sentinel, before any time is believed.
import { performance } from 'node:perf_hooks'

import { makeBpMapper } from '../src/canvas2dUtils.ts'
import { abgrToCssRgba } from '../src/marks/colorFill.ts'
import { lineCenterMark, lineStepMark } from '../src/marks/lineMark.ts'
import { makeScoreNormalizer } from '../src/scoreScale.ts'
import { GAP_Y, NO_PREV_X } from '../src/shaders/lineMark.consts.generated.ts'
import * as line from '../src/shaders/lineMark.generated.ts'

import type { LineChannels } from '../src/marks/lineMark.ts'
import type { MarkContext2D } from '../src/marks/types.ts'
import type { RenderBlock } from '../src/renderBlock.ts'

const arg = (name: string, fallback: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const rounds = Number(arg('rounds', '15'))
const n = arg('size', '100k') === '1m' ? 1_000_000 : 100_000

// ---- the data: one source, tiling 10 bp spans, a hole every fiftieth
const positions = new Uint32Array(n * 2)
const scores = new Float32Array(n)
{
  let bp = 1000
  for (let i = 0; i < n; i++) {
    if (i % 50 === 49) {
      bp += 10
    }
    positions[i * 2] = bp
    positions[i * 2 + 1] = bp + 10
    scores[i] = ((i * 7919) % 1000) / 10
    bp += 10
  }
}
const RED = 0xff0000ff
const DOMAIN: [number, number] = [0, 100]
const GAP_LIMIT_BP = 25
const CANVAS_HEIGHT = 100
const LINE_WIDTH = 1.5
const block: RenderBlock = {
  displayedRegionIndex: 0,
  start: 1000,
  end: 1000 + n * 10.2,
  screenStartPx: 0,
  screenEndPx: 1500,
  reversed: false,
}

// ---- wiggle's side, copied verbatim from wiggleInstanceBuffer.ts and
// wiggleDrawFunctions.ts on 2026-09-16, reduced to one source and a constant
// colour; the retired record layout is wiggleLine.iface.generated.ts's.
const NO_PREV_START = 0xffffffff
const LINE_STRIDE_WORDS = 10
const LINE_U32 = { startEnd: 0, color: 5, prevStartEnd: 7 }
const LINE_F32 = {
  score: 2,
  prevScore: 3,
  nextScore: 4,
  rowIndex: 6,
  prevScoreLine: 9,
}

interface Source {
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
  rowIndex: number
  gapLimitBp: number
}
const source: Source = {
  featurePositions: positions,
  featureScores: scores,
  numFeatures: n,
  rowIndex: 0,
  gapLimitBp: GAP_LIMIT_BP,
}

function retiredPack(source: Source, centerLine: boolean) {
  const buf = new ArrayBuffer(source.numFeatures * LINE_STRIDE_WORDS * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  const row = source.rowIndex
  const colorAbgr = RED
  const positions = source.featurePositions
  const scores = source.featureScores
  const n = source.numFeatures
  const gapLimitBp = source.gapLimitBp
  for (let i = 0; i < n; i++) {
    const pi = i * 2
    const score = scores[i]!
    const currStart = positions[pi]!
    const currEnd = positions[pi + 1]!
    u32[off + LINE_U32.startEnd] = currStart
    u32[off + LINE_U32.startEnd + 1] = currEnd
    f32[off + LINE_F32.score] = score
    u32[off + LINE_U32.color] = colorAbgr
    f32[off + LINE_F32.rowIndex] = row
    if (centerLine) {
      const prevLinked =
        i > 0 &&
        (currStart + currEnd) / 2 -
          (positions[pi - 2]! + positions[pi - 1]!) / 2 <=
          gapLimitBp
      u32[off + LINE_U32.prevStartEnd] = prevLinked
        ? positions[pi - 2]!
        : NO_PREV_START
      u32[off + LINE_U32.prevStartEnd + 1] = prevLinked ? positions[pi - 1]! : 0
      f32[off + LINE_F32.prevScoreLine] = prevLinked ? scores[i - 1]! : 0
    } else {
      const prevAdj = i > 0 && positions[pi - 1] === currStart
      const nextAdj = i < n - 1 && positions[pi + 2] === currEnd
      f32[off + LINE_F32.prevScore] = prevAdj ? scores[i - 1]! : 0
      f32[off + LINE_F32.nextScore] = nextAdj ? score : 0
    }
    off += LINE_STRIDE_WORDS
  }
  return buf
}

function controlPack(source: Source, centerLine: boolean) {
  const buf = new ArrayBuffer(source.numFeatures * LINE_STRIDE_WORDS * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  const row = source.rowIndex
  const colorAbgr = RED
  const positions = source.featurePositions
  const scores = source.featureScores
  const n = source.numFeatures
  const gapLimitBp = source.gapLimitBp
  for (let i = 0; i < n; i++) {
    const pi = i * 2
    const score = scores[i]!
    const currStart = positions[pi]!
    const currEnd = positions[pi + 1]!
    u32[off + LINE_U32.startEnd] = currStart
    u32[off + LINE_U32.startEnd + 1] = currEnd
    f32[off + LINE_F32.score] = score
    u32[off + LINE_U32.color] = colorAbgr
    f32[off + LINE_F32.rowIndex] = row
    if (centerLine) {
      const prevLinked =
        i > 0 &&
        (currStart + currEnd) / 2 -
          (positions[pi - 2]! + positions[pi - 1]!) / 2 <=
          gapLimitBp
      u32[off + LINE_U32.prevStartEnd] = prevLinked
        ? positions[pi - 2]!
        : NO_PREV_START
      u32[off + LINE_U32.prevStartEnd + 1] = prevLinked ? positions[pi - 1]! : 0
      f32[off + LINE_F32.prevScoreLine] = prevLinked ? scores[i - 1]! : 0
    } else {
      const prevAdj = i > 0 && positions[pi - 1] === currStart
      const nextAdj = i < n - 1 && positions[pi + 2] === currEnd
      f32[off + LINE_F32.prevScore] = prevAdj ? scores[i - 1]! : 0
      f32[off + LINE_F32.nextScore] = nextAdj ? score : 0
    }
    off += LINE_STRIDE_WORDS
  }
  return buf
}

function makeScoreToY(rowHeight: number) {
  const normalize = makeScoreNormalizer(DOMAIN[0], DOMAIN[1], 0, 1)
  return (score: number) => (1 - normalize(score)) * rowHeight
}

function retiredDrawLine(
  ctx: MarkContext2D,
  source: Source,
  block: RenderBlock,
) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  ctx.strokeStyle = abgrToCssRgba(RED)
  ctx.lineWidth = LINE_WIDTH
  ctx.beginPath()
  const scoreToY = makeScoreToY(CANVAS_HEIGHT)
  const rowTop = 0
  const zeroY = scoreToY(0) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  let inRun = false
  for (let i = 0; i < n; i++) {
    const startBp = positions[i * 2]!
    const endBp = positions[i * 2 + 1]!
    const x1 = toX(startBp)
    const x2 = toX(endBp)
    const scoreY = scoreToY(scores[i]!) + rowTop
    if (inRun) {
      ctx.lineTo(x1, scoreY)
    } else {
      ctx.moveTo(x1, zeroY)
      ctx.lineTo(x1, scoreY)
      inRun = true
    }
    ctx.lineTo(x2, scoreY)
    const nextStartBp = i < n - 1 ? positions[(i + 1) * 2]! : -1
    const gapAfter = nextStartBp !== endBp
    if (gapAfter) {
      ctx.lineTo(x2, zeroY)
      inRun = false
    }
  }
  ctx.stroke()
}

function controlDrawLine(
  ctx: MarkContext2D,
  source: Source,
  block: RenderBlock,
) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  ctx.strokeStyle = abgrToCssRgba(RED)
  ctx.lineWidth = LINE_WIDTH
  ctx.beginPath()
  const scoreToY = makeScoreToY(CANVAS_HEIGHT)
  const rowTop = 0
  const zeroY = scoreToY(0) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  let inRun = false
  for (let i = 0; i < n; i++) {
    const startBp = positions[i * 2]!
    const endBp = positions[i * 2 + 1]!
    const x1 = toX(startBp)
    const x2 = toX(endBp)
    const scoreY = scoreToY(scores[i]!) + rowTop
    if (inRun) {
      ctx.lineTo(x1, scoreY)
    } else {
      ctx.moveTo(x1, zeroY)
      ctx.lineTo(x1, scoreY)
      inRun = true
    }
    ctx.lineTo(x2, scoreY)
    const nextStartBp = i < n - 1 ? positions[(i + 1) * 2]! : -1
    const gapAfter = nextStartBp !== endBp
    if (gapAfter) {
      ctx.lineTo(x2, zeroY)
      inRun = false
    }
  }
  ctx.stroke()
}

function retiredDrawLineCenter(
  ctx: MarkContext2D,
  source: Source,
  block: RenderBlock,
) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  ctx.strokeStyle = abgrToCssRgba(RED)
  ctx.lineWidth = LINE_WIDTH
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  const scoreToY = makeScoreToY(CANVAS_HEIGHT)
  const rowTop = 0
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  const gapLimitBp = source.gapLimitBp
  for (let i = 0; i < n; i++) {
    const pi = i * 2
    const cx = (toX(positions[pi]!) + toX(positions[pi + 1]!)) / 2
    const cy = scoreToY(scores[i]!) + rowTop
    const linked =
      i > 0 &&
      (positions[pi]! + positions[pi + 1]!) / 2 -
        (positions[pi - 2]! + positions[pi - 1]!) / 2 <=
        gapLimitBp
    if (linked) {
      ctx.lineTo(cx, cy)
    } else {
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx, cy)
    }
  }
  ctx.stroke()
}

function controlDrawLineCenter(
  ctx: MarkContext2D,
  source: Source,
  block: RenderBlock,
) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  ctx.strokeStyle = abgrToCssRgba(RED)
  ctx.lineWidth = LINE_WIDTH
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.beginPath()
  const scoreToY = makeScoreToY(CANVAS_HEIGHT)
  const rowTop = 0
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  const gapLimitBp = source.gapLimitBp
  for (let i = 0; i < n; i++) {
    const pi = i * 2
    const cx = (toX(positions[pi]!) + toX(positions[pi + 1]!)) / 2
    const cy = scoreToY(scores[i]!) + rowTop
    const linked =
      i > 0 &&
      (positions[pi]! + positions[pi + 1]!) / 2 -
        (positions[pi - 2]! + positions[pi - 1]!) / 2 <=
        gapLimitBp
    if (linked) {
      ctx.lineTo(cx, cy)
    } else {
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx, cy)
    }
  }
  ctx.stroke()
}

// ---- the shape's side
function split(positions: Uint32Array, count: number) {
  const x = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  for (let i = 0; i < count; i++) {
    x[i] = positions[i * 2]!
    x2[i] = positions[i * 2 + 1]!
  }
  return { x, x2 }
}
const { x, x2 } = split(positions, n)
const channels: LineChannels = {
  x,
  x2,
  y: scores,
  color: new Uint32Array(n).fill(RED),
  gapBp: GAP_LIMIT_BP,
  count: n,
}
const frame = { canvasWidth: 1500, canvasHeight: CANVAS_HEIGHT }
const params = { domain: DOMAIN, origin: 0, lineWidth: LINE_WIDTH }

// every path point in order, with a stroke as a marker, for the identity check
function pointRecorder() {
  const points: [number, number][] = []
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    beginPath() {},
    moveTo(x: number, y: number) {
      points.push([x, y])
    },
    lineTo(x: number, y: number) {
      points.push([x, y])
    },
    stroke() {
      points.push([NaN, NaN])
    },
    fill() {},
  } as unknown as MarkContext2D
  return { ctx, points }
}

// a stub context that only counts, so the timed arms pay the path-building
// calls and nothing else, the same for every arm
function countingContext() {
  let calls = 0
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    beginPath() {
      calls++
    },
    moveTo() {
      calls++
    },
    lineTo() {
      calls++
    },
    stroke() {
      calls++
    },
    fill() {},
  } as unknown as MarkContext2D
  return { ctx, count: () => calls }
}

// ---- timing
interface Arm {
  name: string
  run: () => number
}
const table: { group: string; arms: Arm[] }[] = [
  {
    group: 'pack',
    arms: [
      {
        name: 'retired',
        run: () =>
          retiredPack(source, false).byteLength +
          retiredPack(source, true).byteLength,
      },
      {
        name: 'control',
        run: () =>
          controlPack(source, false).byteLength +
          controlPack(source, true).byteLength,
      },
      // one pack fills both neighbour sets, so it stands against both retired packs
      {
        name: 'ported',
        run: () => lineStepMark.pass.pack(channels).byteLength,
      },
      { name: 'lens', run: () => split(positions, n).x.length },
    ],
  },
  {
    group: 'step',
    arms: [
      {
        name: 'retired',
        run: () => {
          const { ctx, count } = countingContext()
          retiredDrawLine(ctx, source, block)
          return count()
        },
      },
      {
        name: 'control',
        run: () => {
          const { ctx, count } = countingContext()
          controlDrawLine(ctx, source, block)
          return count()
        },
      },
      {
        name: 'ported',
        run: () => {
          const { ctx, count } = countingContext()
          lineStepMark.paintBlock(ctx, channels, block, frame, params)
          return count()
        },
      },
    ],
  },
  {
    group: 'center',
    arms: [
      {
        name: 'retired',
        run: () => {
          const { ctx, count } = countingContext()
          retiredDrawLineCenter(ctx, source, block)
          return count()
        },
      },
      {
        name: 'control',
        run: () => {
          const { ctx, count } = countingContext()
          controlDrawLineCenter(ctx, source, block)
          return count()
        },
      },
      {
        name: 'ported',
        run: () => {
          const { ctx, count } = countingContext()
          lineCenterMark.paintBlock(ctx, channels, block, frame, params)
          return count()
        },
      },
    ],
  },
]

for (const { arms } of table) {
  for (const arm of arms) {
    arm.run()
  }
}
const best = table.map(({ arms }) => arms.map(() => Infinity))
const checks = table.map(({ arms }) => arms.map(a => a.run()))
for (let r = 0; r < rounds; r++) {
  for (const [g, { arms }] of table.entries()) {
    for (const [i, arm] of arms.entries()) {
      const t0 = performance.now()
      const out = arm.run()
      const ms = performance.now() - t0
      if (out !== checks[g]![i]) {
        throw new Error(`${arm.name} changed its answer between rounds`)
      }
      best[g]![i] = Math.min(best[g]![i]!, ms)
    }
  }
}

// ---- identity, after timing so the retired painters meet one context shape while timed
{
  for (const reversed of [false, true]) {
    const b = { ...block, reversed }
    const compare = (
      label: string,
      retired: (ctx: MarkContext2D) => void,
      ported: (ctx: MarkContext2D) => void,
    ) => {
      const a = pointRecorder()
      retired(a.ctx)
      const p = pointRecorder()
      ported(p.ctx)
      const ap = a.points
      const pp = p.points
      if (ap.length !== pp.length) {
        throw new Error(
          `${label} ${reversed ? 'reversed' : 'forward'}: retired ${ap.length} points, ported ${pp.length}`,
        )
      }
      for (let i = 0; i < ap.length; i++) {
        const stroke = Number.isNaN(ap[i]![0])
        if (
          stroke !== Number.isNaN(pp[i]![0]) ||
          (!stroke &&
            (Math.abs(ap[i]![0] - pp[i]![0]) > 1e-6 ||
              Math.abs(ap[i]![1] - pp[i]![1]) > 1e-6))
        ) {
          throw new Error(
            `${label} ${reversed ? 'reversed' : 'forward'}: point ${i} retired ${ap[i]} ported ${pp[i]}`,
          )
        }
      }
    }
    compare(
      'step',
      ctx => {
        retiredDrawLine(ctx, source, b)
      },
      ctx => {
        lineStepMark.paintBlock(ctx, channels, b, frame, params)
      },
    )
    compare(
      'center',
      ctx => {
        retiredDrawLineCenter(ctx, source, b)
      },
      ctx => {
        lineCenterMark.paintBlock(ctx, channels, b, frame, params)
      },
    )
  }
  const rs = new Float32Array(retiredPack(source, false))
  const rsU = new Uint32Array(rs.buffer)
  const rc = new Float32Array(retiredPack(source, true))
  const rcU = new Uint32Array(rc.buffer)
  const pb = lineStepMark.pass.pack(channels)
  const pf = new Float32Array(pb)
  const pu = new Uint32Array(pb)
  for (let i = 0; i < n; i++) {
    const ro = i * LINE_STRIDE_WORDS
    const po = i * line.INSTANCE_STRIDE_WORDS
    const same =
      rsU[ro + LINE_U32.startEnd] === pu[po + line.INSTANCE_OFFSET_U32.x] &&
      rsU[ro + LINE_U32.startEnd + 1] ===
        pu[po + line.INSTANCE_OFFSET_U32.x2] &&
      rs[ro + LINE_F32.score] === pf[po + line.INSTANCE_OFFSET_F32.y] &&
      rsU[ro + LINE_U32.color] === pu[po + line.INSTANCE_OFFSET_U32.color]
    const prevAdj = i > 0 && positions[i * 2 - 1] === positions[i * 2]
    const nextAdj = i < n - 1 && positions[i * 2 + 2] === positions[i * 2 + 1]
    const stepSame =
      (prevAdj
        ? rs[ro + LINE_F32.prevScore] ===
          pf[po + line.INSTANCE_OFFSET_F32.prevY]
        : pf[po + line.INSTANCE_OFFSET_F32.prevY]! < GAP_Y * 0.5) &&
      (nextAdj
        ? rs[ro + LINE_F32.nextScore] ===
          pf[po + line.INSTANCE_OFFSET_F32.nextY]
        : pf[po + line.INSTANCE_OFFSET_F32.nextY]! < GAP_Y * 0.5)
    const retiredPrev = rcU[ro + LINE_U32.prevStartEnd]!
    const centerSame =
      (retiredPrev === NO_PREV_START
        ? pu[po + line.INSTANCE_OFFSET_U32.prevX] === NO_PREV_X
        : retiredPrev === pu[po + line.INSTANCE_OFFSET_U32.prevX] &&
          rcU[ro + LINE_U32.prevStartEnd + 1] ===
            pu[po + line.INSTANCE_OFFSET_U32.prevX2]) &&
      rc[ro + LINE_F32.prevScoreLine] ===
        pf[po + line.INSTANCE_OFFSET_F32.prevYLine]
    if (!same || !stepSame || !centerSame) {
      throw new Error(`pack: instance ${i} differs between retired and ported`)
    }
  }
  console.log(`identity ok over ${n.toLocaleString()} instances`)
}

console.log(
  `\n${n.toLocaleString()} instances, rounds=${rounds}, min per arm, ratio to retired`,
)
for (const [g, { group, arms }] of table.entries()) {
  const retired = best[g]![0]!
  for (const [i, { name }] of arms.entries()) {
    const ms = best[g]![i]!
    console.log(
      `  ${group.padEnd(7)} ${name.padEnd(8)} ${ms.toFixed(2).padStart(8)}ms  ${((ms / n) * 1e6).toFixed(0).padStart(5)}ns/instance  ${(ms / retired).toFixed(2)}x`,
    )
  }
}
