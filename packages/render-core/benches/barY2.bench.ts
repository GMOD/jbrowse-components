// What does the `y2` lane cost a bar that stands on the origin, which is every
// bar drawn before a stack existed? The instance struct grew a float per bar
// whether or not a caller names `y2`, so the pack writes one more word and the
// Canvas2D painter reads one more branch.
//
//   node packages/render-core/benches/barY2.bench.ts
//   node packages/render-core/benches/barY2.bench.ts --bars=1000000 --rounds=10 --base=main
//
// Arms, interleaved round-robin with the order rotated, MIN across rounds
// (agent-docs/reference/BENCHMARKING.md): `base` is the ref's barMark,
// `control` the ref extracted a second time, `head` the working tree's, each
// over the same origin-standing bars through its own driver; `head-y2` is the
// working tree over the same bars with a `y2` lane, what a stack pays.
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

import { checkoutPackageAtRef } from '../../../plugins/maf/benches/refCheckout.ts'

import type { BarChannels, BarParams } from '../src/marks/barMark.ts'
import type { MarkContext2D } from '../src/marks/types.ts'

const flag = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
const num = (name: string, fallback: number) => Number(flag(name) ?? fallback)
const rounds = num('rounds', 10)
const n = num('bars', 1_000_000)
const baseRef = flag('base') ?? 'main'
const root = join(import.meta.dirname, '..', '..', '..')

interface Bar {
  pass: { pack: (c: BarChannels) => ArrayBuffer }
  paintBlock: (
    ctx: MarkContext2D,
    c: BarChannels,
    block: unknown,
    frame: unknown,
    params: BarParams,
  ) => void
}

async function markAt(dir: string): Promise<Bar> {
  const mod = await import(
    join(dir, 'packages/render-core/src/marks/barMark.ts')
  )
  return mod.barMark as Bar
}

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: n * 4,
  screenStartPx: 0,
  screenEndPx: 1600,
  reversed: false,
}
const frame = { canvasWidth: 1600, canvasHeight: 200 }
const params: BarParams = {
  domain: [0, 1],
  origin: 0,
  minWidthPx: 0,
  seamPx: 0,
}

const xs = Uint32Array.from({ length: n }, (_, i) => i * 4)
const x2s = Uint32Array.from({ length: n }, (_, i) => i * 4 + 3)
const ys = Float32Array.from({ length: n }, (_, i) => ((i * 13) % 100) / 100)
const y2s = Float32Array.from({ length: n }, (_, i) => ((i * 7) % 50) / 100)
const colors = Uint32Array.from(
  { length: n },
  (_, i) => 0xff000000 | (i & 0xff),
)

function bars(y2: boolean): BarChannels {
  return {
    x: xs,
    x2: x2s,
    y: ys,
    color: colors,
    count: n,
    ...(y2 ? { y2: y2s } : {}),
  }
}

let sunk = 0
const ctx = {
  set fillStyle(v: string) {
    sunk += v.length
  },
  fillRect(_x: number, _y: number, _w: number, _h: number) {},
} as unknown as MarkContext2D

async function main() {
  const baseDir = checkoutPackageAtRef(root, baseRef, 'packages/render-core')
  const controlDir = checkoutPackageAtRef(root, baseRef, 'packages/render-core')
  const base = await markAt(baseDir)
  const control = await markAt(controlDir)
  const head = (await import('../src/marks/barMark.ts')).barMark as Bar

  const plainBase = bars(false)
  const plainControl = bars(false)
  const plainHead = bars(false)
  const stacked = bars(true)
  const stackedParams = { ...params, standsOnY2: true }

  const arms: [string, () => number][] = [
    ['pack base', () => base.pass.pack(plainBase).byteLength],
    ['pack control', () => control.pass.pack(plainControl).byteLength],
    ['pack head', () => head.pass.pack(plainHead).byteLength],
    ['pack head-y2', () => head.pass.pack(stacked).byteLength],
    [
      'paint base',
      () => (base.paintBlock(ctx, plainBase, block, frame, params), 0),
    ],
    [
      'paint control',
      () => (control.paintBlock(ctx, plainControl, block, frame, params), 0),
    ],
    [
      'paint head',
      () => (head.paintBlock(ctx, plainHead, block, frame, params), 0),
    ],
    [
      'paint head-y2',
      () => (head.paintBlock(ctx, stacked, block, frame, stackedParams), 0),
    ],
  ]
  const best = new Map<string, number>()
  const bytes = new Map<string, number>()
  for (let r = 0; r < rounds; r++) {
    for (let k = 0; k < arms.length; k++) {
      const [name, run] = arms[(k + r) % arms.length]!
      const t0 = performance.now()
      const b = run()
      const dt = performance.now() - t0
      best.set(name, Math.min(best.get(name) ?? Infinity, dt))
      bytes.set(name, b)
    }
  }
  const baselineOf = (name: string) =>
    best.get(name.replace(/ (control|head(-y2)?)$/, ' base'))!
  console.log(
    `${n.toLocaleString()} bars, min of ${rounds} rounds (sunk ${sunk})`,
  )
  for (const [name] of arms) {
    const ms = best.get(name)!
    const b = bytes.get(name)!
    console.log(
      `${name.padEnd(14)} ${ms.toFixed(1).padStart(8)} ms  ${(ms / baselineOf(name)).toFixed(2)}x${b ? `  ${(b / 1e6).toFixed(1)} MB` : ''}`,
    )
  }
  rmSync(baseDir, { recursive: true, force: true })
  rmSync(controlDir, { recursive: true, force: true })
}

await main()
