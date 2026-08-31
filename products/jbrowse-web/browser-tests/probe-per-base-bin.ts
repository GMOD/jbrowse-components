/* eslint-disable no-console */
// Does the per-base sub-pixel bin change the picture?
//
// `subPixelBinBp` makes the two per-base colour modes sample one aligned base
// per sub-pixel window instead of every base, which took a 1 Mb pacbio pileup's
// worker extract from 30.5M entries to 59.6k
// (agent-docs/measurements/per-base-wall-bin.json). The claim that buys it is
// that nothing VISIBLE changes: `binBp <= bpPerPx / 2` while both backends floor
// a per-base cell to 1 CSS px, so the surviving samples overlap rather than
// gap. That is arithmetic, and `reference/MAF_SUBPIXEL_CELLS.md` is the in-tree
// argument for why a sub-pixel claim gets looked at instead of reasoned about.
//
// TWO ARMS, one build each. The bin has no runtime switch, so the `before` arm
// is `perBaseBinBp` in plugins/alignments/src/LinearAlignmentsDisplay/model.ts
// edited to `return 1` — flip it, rebuild, capture, and put it back. Nothing in
// the tree carries a changed value.
//
//     pnpm --filter @jbrowse/web build
//     node browser-tests/probe-per-base-bin.ts --out=/tmp/pbb/after
//     # edit the getter to `return 1`, rebuild
//     node browser-tests/probe-per-base-bin.ts --out=/tmp/pbb/before
//     node browser-tests/probe-per-base-bin.ts --diff /tmp/pbb/before /tmp/pbb/after
//
// TWO CONTROLS, and they are what makes a small diff readable:
//
//   normal-8bp     colorBy `normal` at the same zoom. Never reaches the per-base
//                  extract, so it must come back byte-identical. A difference
//                  here is the capture drifting, not the bin.
//   quality-1bp    the SAME per-base mode at ~1 bp/px, where `subPixelBinBp`
//                  returns 1 in both arms. Byte-identical is the claim that the
//                  rule is inert at every zoom where a base is legible — the
//                  half of it a reader most wants checked.
//
// Chrome on SwiftShader, not Firefox/WebGPU: the question is which entries reach
// the painter, not how the shader antialiases one, and software WebGL2 is the
// backend that reproduces byte-for-byte between two runs.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'

import { displayPainted } from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import {
  delay,
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

import type { Page } from 'puppeteer'

const arg = (name: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const OUT = arg('out')
const PILEUP = displayPainted('pileup-display')

// ctgA is ~50kb of volvox short reads. A ~1000px canvas over each span puts the
// zoom in the third column, and `subPixelBinBp` picks the fourth.
const SCENES = [
  { name: 'quality-4bp', colorBy: 'perBaseQuality', loc: 'ctgA:1..4,000' },
  { name: 'quality-8bp', colorBy: 'perBaseQuality', loc: 'ctgA:1..8,000' },
  { name: 'quality-32bp', colorBy: 'perBaseQuality', loc: 'ctgA:1..32,000' },
  // the whole contig — volvox's widest, and the biggest bin it can reach
  { name: 'quality-48bp', colorBy: 'perBaseQuality', loc: 'ctgA:1..48,000' },
  { name: 'letter-48bp', colorBy: 'perBaseLetter', loc: 'ctgA:1..48,000' },
  { name: 'letter-4bp', colorBy: 'perBaseLetter', loc: 'ctgA:1..4,000' },
  { name: 'letter-8bp', colorBy: 'perBaseLetter', loc: 'ctgA:1..8,000' },
  // controls — see the header
  { name: 'normal-8bp', colorBy: 'normal', loc: 'ctgA:1..8,000' },
  { name: 'quality-1bp', colorBy: 'perBaseQuality', loc: 'ctgA:1..1,000' },
] as const

function compare(a: Uint8Array, b: Uint8Array) {
  // @ts-expect-error pngjs accepts a Uint8Array at runtime — the cast
  // `pngDiff.ts` and `probe-bar-top-aa.ts` both make
  const pa = PNG.sync.read(a)
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  const pb = PNG.sync.read(b)
  if (pa.width !== pb.width || pa.height !== pb.height) {
    throw new Error(
      `size mismatch: ${pa.width}x${pa.height} vs ${pb.width}x${pb.height}`,
    )
  }
  const { width, height } = pa
  const diff = new PNG({ width, height })
  let differing = 0
  let sum = 0
  let maxDelta = 0
  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    let d = 0
    for (let c = 0; c < 4; c++) {
      d = Math.max(d, Math.abs(pa.data[i + c]! - pb.data[i + c]!))
    }
    diff.data[i + 3] = 255
    if (d > 0) {
      differing++
      sum += d
      maxDelta = Math.max(maxDelta, d)
      diff.data[i] = 255
      diff.data[i + 1] = 255 - Math.min(255, d)
    }
  }
  return {
    differing,
    total: width * height,
    meanDelta: differing > 0 ? sum / differing : 0,
    maxDelta,
    diffImage: PNG.sync.write(diff),
  }
}

function runDiff(dirA: string, dirB: string, outDir?: string) {
  console.log(
    'scene'.padEnd(14),
    'differing'.padStart(10),
    'pct'.padStart(8),
    'meanD'.padStart(7),
    'maxD'.padStart(6),
  )
  for (const name of readdirSync(dirA)
    .filter(f => f.endsWith('.png'))
    .sort()) {
    if (!existsSync(join(dirB, name))) {
      console.log(`${basename(name, '.png').padEnd(14)} (no counterpart)`)
      continue
    }
    const s = compare(
      readFileSync(join(dirA, name)),
      readFileSync(join(dirB, name)),
    )
    console.log(
      basename(name, '.png').padEnd(14),
      String(s.differing).padStart(10),
      `${((100 * s.differing) / s.total).toFixed(3)}%`.padStart(8),
      s.meanDelta.toFixed(1).padStart(7),
      String(s.maxDelta).padStart(6),
    )
    if (outDir) {
      mkdirSync(outDir, { recursive: true })
      writeFileSync(join(outDir, name), s.diffImage)
    }
  }
}

async function captureScene(
  page: Page,
  scene: (typeof SCENES)[number],
  outDir: string,
) {
  await navigateWithSessionSpec(page, {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: scene.loc,
        tracks: [
          {
            trackId: 'volvox_alignments',
            displaySnapshot: { colorBy: { type: scene.colorBy } },
          },
        ],
      },
    ],
  })
  await waitForDataLoaded(page)
  const el = await page.waitForSelector(`${PILEUP} canvas`, { timeout: 60000 })
  if (!el) {
    throw new Error(`${scene.name}: no painted canvas`)
  }
  // The per-base overlay is painted by an autorun `waitForDataLoaded` does not
  // watch, so give the frame after the last model write somewhere to land.
  await delay(2500)
  const readBack = await page.evaluate(() => {
    const d = (window as any).JBrowseSession.views[0].tracks[0].displays[0]
    return { binBp: d.perBaseBinBp, bpPerPx: d.view.coarseBpPerPx }
  })
  const shot = await el.screenshot({ type: 'png' })
  writeFileSync(join(outDir, `${scene.name}.png`), shot)
  // @ts-expect-error pngjs accepts a Uint8Array at runtime
  const png = PNG.sync.read(shot)
  console.log(
    `${scene.name.padEnd(14)} ${scene.colorBy.padEnd(15)} ` +
      `${readBack.bpPerPx.toFixed(2).padStart(7)} bp/px  binBp ${String(readBack.binBp).padStart(3)}  ` +
      `${png.width}x${png.height}`,
  )
}

async function main() {
  if (process.argv.includes('--diff')) {
    const i = process.argv.indexOf('--diff')
    const [dirA, dirB] = [process.argv[i + 1], process.argv[i + 2]]
    if (!dirA || !dirB) {
      throw new Error('--diff needs two directories')
    }
    runDiff(dirA, dirB, OUT)
    return
  }
  if (!OUT) {
    throw new Error('pass --out=<dir>')
  }
  mkdirSync(OUT, { recursive: true })
  const { port, server } = await startServerOnFreePort(3571)
  setPort(port)
  const browser = await launch({
    headless: true,
    timeout: 60000,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    defaultViewport: { width: 1280, height: 800 },
  })
  const page = await browser.newPage()
  try {
    console.log('scene'.padEnd(14), 'colorBy'.padEnd(15), '  bp/px  bin  size')
    for (const scene of SCENES) {
      await captureScene(page, scene, OUT)
    }
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
