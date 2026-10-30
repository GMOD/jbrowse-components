// Draws a pass's generated WGSL on a real GPU at 4 samples and at 1, and scores
// both against the fixture's ideal scene.
//
//   node scripts/gpu-pixels/run.ts [fixture…] [--adapter=llvmpipe]
//     [--dpr=1,1.5] [--base=<git ref>] [--png=<dir>] [--supersample=32]
//
// The reference is an NxN supersample, 8 by default. Every pixel along a long
// axis-aligned edge sits at the same fraction of a pixel, so 8's rounding
// does not average out: an edge 0.556 into a pixel reads as 4/8 covered
// against 0.444 exact, and 4x MSAA's sample rows round the same way. At 8 a
// pass that measures its own coverage scores up to ~5% worse than it is, and
// MSAA flatters itself. Judge a coverage pass at 32, which takes ~16x longer.
//
// Exits 1 when a one-sample render breaks its fixture's budget.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { crc32, deflateSync } from 'node:zlib'

import { FIXTURES } from './fixtures/index.ts'
import { openGpu, render } from './gpu.ts'

import type { Budget, PixelFixture } from './fixture.ts'

const root = path.resolve(import.meta.dirname, '../..')

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    adapter: { type: 'string' },
    dpr: { type: 'string' },
    base: { type: 'string' },
    png: { type: 'string' },
    supersample: { type: 'string', default: '8' },
  },
})

function generatedAt(ref: string | undefined, slang: string, kind: string) {
  const file = slang.replace(/\.slang$/, `.${kind}.generated.ts`)
  return ref === undefined
    ? readFileSync(path.join(root, file), 'utf8')
    : execFileSync('git', ['show', `${ref}:${file}`], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 1 << 26,
      })
}

/**
 * The pass's WGSL at a git ref, drawn through today's instance and uniform
 * layout: an interface that moved since makes the comparison meaningless, so
 * it says so.
 */
function wgslAt(ref: string, slang: string) {
  const withoutStamp = (s: string) => s.replace(/^\/\/ inputs: .*$/m, '')
  if (
    withoutStamp(generatedAt(ref, slang, 'iface')) !==
    withoutStamp(generatedAt(undefined, slang, 'iface'))
  ) {
    console.warn(
      `  ${slang}'s interface differs at ${ref}; its rows mean nothing if the instance or uniform layout moved`,
    )
  }
  const m = /export const WGSL_SOURCE = (".*")\n/.exec(
    generatedAt(ref, slang, 'wgsl'),
  )
  if (!m) {
    throw new Error(`${ref}:${slang} has no WGSL_SOURCE`)
  }
  return JSON.parse(m[1]!) as string
}

/** The ideal scene, area-averaged over each device pixel. */
function referenceImage(f: PixelFixture, dpr: number, w: number, h: number) {
  const img = new Float64Array(w * h * 4)
  const n = Number(values.supersample)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = (j * w + i) * 4
      for (let sj = 0; sj < n; sj++) {
        for (let si = 0; si < n; si++) {
          const c = f.reference(
            (i + (si + 0.5) / n) / dpr,
            (j + (sj + 0.5) / n) / dpr,
            dpr,
          )
          for (let ch = 0; ch < 4; ch++) {
            img[k + ch]! += c[ch]! / (n * n)
          }
        }
      }
    }
  }
  return img
}

interface Score {
  max: number
  meanErr: number
  over: number
  twice: number
  holes: number
}

function score(f: PixelFixture, px: Uint8Array, ref: Float64Array): Score {
  let max = 0
  let sum = 0
  let ink = 0
  let over = 0
  let twice = 0
  let holes = 0
  const a = f.translucent
  for (let k = 0; k < ref.length; k += 4) {
    let err = 0
    for (let ch = 0; ch < 4; ch++) {
      err = Math.max(err, Math.abs(px[k + ch]! / 255 - ref[k + ch]!))
    }
    max = Math.max(max, err)
    sum += err
    ink += ref[k + 3]!
    if (err > 0.1) {
      over++
    }
    if (a !== undefined) {
      const alpha = px[k + 3]!
      if (alpha > a * 255 + 3) {
        twice++
      }
      if (ref[k + 3]! > a - 0.005 && alpha < a * 255 - 8) {
        holes++
      }
    }
  }
  return { max, meanErr: ink > 0 ? sum / ink : 0, over, twice, holes }
}

function breaches(s: Score, b: Budget | undefined) {
  if (!b) {
    return []
  }
  return (['max', 'meanErr', 'twice', 'holes'] as const).filter(
    key => b[key] !== undefined && s[key] > b[key],
  )
}

function pngBytes(rgba: Uint8Array, w: number, h: number) {
  const raw = new Uint8Array((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1)
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = Buffer.alloc(data.length + 12)
    out.writeUInt32BE(data.length, 0)
    out.write(type, 4, 'ascii')
    out.set(data, 8)
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
    return out
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ])
}

/**
 * Reference, one sample, four samples and the one-sample error stacked,
 * premultiplied over white, scaled up so a device pixel reads.
 */
function writePanel(
  file: string,
  panels: (Uint8Array | Float64Array)[],
  w: number,
  h: number,
) {
  const zoom = Math.max(1, Math.floor(1600 / w))
  const gap = 4
  const W = w * zoom
  const H = (h * zoom + gap) * panels.length
  const out = new Uint8Array(W * H * 4).fill(255)
  panels.forEach((img, p) => {
    const scale = img instanceof Float64Array ? 255 : 1
    for (let y = 0; y < h * zoom; y++) {
      for (let x = 0; x < W; x++) {
        const k = (Math.floor(y / zoom) * w + Math.floor(x / zoom)) * 4
        const o = ((p * (h * zoom + gap) + y) * W + x) * 4
        const a = img[k + 3]! * scale
        for (let ch = 0; ch < 3; ch++) {
          out[o + ch] = Math.round(img[k + ch]! * scale + 255 - a)
        }
      }
    }
  })
  writeFileSync(file, pngBytes(out, W, H))
}

function errorImage(px: Uint8Array, ref: Float64Array) {
  const out = new Float64Array(ref.length)
  for (let k = 0; k < ref.length; k += 4) {
    let err = 0
    for (let ch = 0; ch < 4; ch++) {
      err = Math.max(err, Math.abs(px[k + ch]! / 255 - ref[k + ch]!))
    }
    out[k] = Math.min(1, err * 4)
    out[k + 3] = Math.min(1, err * 4)
  }
  return out
}

function diffCount(a: Uint8Array, b: Uint8Array) {
  let n = 0
  let max = 0
  for (let k = 0; k < a.length; k += 4) {
    let d = 0
    for (let ch = 0; ch < 4; ch++) {
      d = Math.max(d, Math.abs(a[k + ch]! - b[k + ch]!))
    }
    if (d > 0) {
      n++
    }
    max = Math.max(max, d)
  }
  return { n, max }
}

const chosen = positionals.length
  ? FIXTURES.filter(f => positionals.some(p => f.name.startsWith(p)))
  : FIXTURES
if (chosen.length === 0) {
  console.error(
    `no fixture matches; have ${FIXTURES.map(f => f.name).join(', ')}`,
  )
  process.exit(2)
}
const dprOverride = values.dpr?.split(',').map(Number)
const gpu = await openGpu(values.adapter)
console.log(`adapter: ${gpu.label}`)
console.log(
  'max: worst channel error 0..1; err%: summed error / summed reference ink;',
  '>0.1: pixels off by more than 0.1; twice/holes: translucent double blends',
  'and gaps',
)
if (values.png) {
  mkdirSync(values.png, { recursive: true })
}

const fmt = (s: Score, translucent: boolean) =>
  [
    s.max.toFixed(3).padStart(6),
    (s.meanErr * 100).toFixed(2).padStart(7),
    String(s.over).padStart(6),
    translucent
      ? `${String(s.twice).padStart(6)}${String(s.holes).padStart(6)}`
      : '',
  ].join('')

let failed = false
for (const f of chosen) {
  console.log(`\n${f.name}: ${f.about}`)
  console.log(
    `  dpr  samples    max   err%   >0.1${f.translucent === undefined ? '' : ' twice holes'}`,
  )
  const wgsl = (await f.mod.SOURCE.wgsl()).WGSL_SOURCE
  const baseWgsl = values.base ? wgslAt(values.base, f.slang) : undefined
  for (const dpr of dprOverride ?? f.dprs) {
    const four = await render(gpu, f, wgsl, dpr, 4)
    const one = await render(gpu, f, wgsl, dpr, 1)
    const { w, h } = one
    const ref = referenceImage(f, dpr, w, h)
    const translucent = f.translucent !== undefined
    const s4 = score(f, four.px, ref)
    const s1 = score(f, one.px, ref)
    const bad = breaches(s1, f.budget)
    failed ||= bad.length > 0
    console.log(`  ${String(dpr).padEnd(4)} 4x   ${fmt(s4, translucent)}`)
    console.log(
      `  ${String(dpr).padEnd(4)} 1x   ${fmt(s1, translucent)}${bad.length ? `  OVER BUDGET: ${bad.join(', ')}` : ''}`,
    )
    if (baseWgsl) {
      for (const samples of [4, 1] as const) {
        const now = samples === 4 ? four.px : one.px
        const was = (await render(gpu, f, baseWgsl, dpr, samples)).px
        const d = diffCount(now, was)
        console.log(
          `  ${String(dpr).padEnd(4)} ${samples}x @${values.base} ${fmt(score(f, was, ref), translucent)}  (${d.n} px differ, max ${d.max}/255)`,
        )
      }
    }
    if (values.png) {
      writePanel(
        path.join(values.png, `${f.name}@${dpr}.png`),
        [ref, one.px, four.px, errorImage(one.px, ref)],
        w,
        h,
      )
    }
  }
}
gpu.device.destroy()
process.exit(failed ? 1 : 0)
