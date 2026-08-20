/* eslint-disable no-console */
// The canvas2d-vs-webgl drift on one synteny view, measured with the gate's own
// comparator, under whichever view settings are passed. Written to answer why
// `targeted_hs1-mm39-synteny-clean-ribbon` sits at 1.58% while every other
// synteny pair is at or near 0.00%.
//
//   --curves / --straight   drawCurves (default: both, reported side by side)
//   --dataset=hs1|grape     which whole-genome pair
//   --loc=<a>,<b>           zoom the two rows to these loci instead of showing
//                           the whole genomes.
//
//                           ADDED ON A THEORY THAT MEASURED FALSE, and kept for
//                           the next person to have it: that the whole-genome
//                           views cannot reach the regime where a ribbon is wide
//                           enough to be filled and steep enough for the two
//                           measures of its thickness to disagree, so a zoom was
//                           needed to see it. `--loc=chr1,` reads 0.02% curved,
//                           and 0.02% again on a build with the fill-vs-stroke
//                           fix reverted — it does not exercise that bug at all.
//
//                           What this gate measures is the FRACTION OF DIFFERING
//                           PIXELS, so its sensitivity goes with ribbon COUNT and
//                           not with how wrong any one ribbon is. A zoomed view
//                           holds a handful of blocks, and a handful drawn wrong
//                           is a rounding error on a 1400x350 frame; the
//                           whole-genome view holds thousands, which is why that
//                           one carried the bug as most of its 1.58% and fell to
//                           0.64% when it was fixed. Zoom in to look at a ribbon,
//                           not to make the gate sensitive.
//   --out=<dir>             also write the captures
import fs from 'node:fs'
import path from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { comparePngBuffers } from './pngDiff.ts'
import { startServerOnFreePort } from './server.ts'

const args = process.argv.slice(2)
const arg = (name: string) =>
  args.find(a => a.startsWith(`--${name}=`))?.split('=')[1]

const datasets = {
  hs1: {
    config: 'test_data/hs1_vs_mm39/config.json',
    tracks: ['hs1ToMm39.over.chain.pif'],
    minAlignmentLength: 500000,
    views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
  },
  grape: {
    config: 'test_data/grape_peach_synteny/config.json',
    tracks: ['peach_grape_minimap2'],
    minAlignmentLength: 2000,
    views: [{ assembly: 'grape' }, { assembly: 'peach' }],
  },
} as const

const key = (arg('dataset') ?? 'hs1') as keyof typeof datasets
const { config, ...rest } = datasets[key]
const minlenArg = arg('minlen')
if (minlenArg) {
  ;(rest as { minAlignmentLength: number }).minAlignmentLength =
    Number(minlenArg)
}
// Two comma-separated loci, one per row, in the order the dataset lists its
// assemblies. Left unset the rows show their whole assemblies, which is what
// every entry in the cross-backend gate does.
const locs = arg('loc')?.split(',')
const outDir = arg('out')
if (outDir) {
  fs.mkdirSync(outDir, { recursive: true })
}
const modes = args.includes('--curves')
  ? [true]
  : args.includes('--straight')
    ? [false]
    : [true, false]

const { server, port } = await startServerOnFreePort(3210)

async function capture(drawCurves: boolean, backend: 'canvas2d' | 'webgl') {
  const view = {
    type: 'LinearSyntenyView',
    ...rest,
    views: rest.views.map((v, i) => (locs?.[i] ? { ...v, loc: locs[i] } : v)),
    drawCurves,
    autoDiagonalize: !args.includes('--no-diagonalize'),
    colorBy: 'query',
    alpha: 0.4,
    levelHeights: [350],
  }
  const browser = await launch({
    headless: true,
    args: [
      ...BASE_CHROME_ARGS,
      ...(backend === 'canvas2d' ? ['--disable-gpu'] : ['--use-gl=angle']),
    ],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 800 })
    const url =
      `http://localhost:${port}/?config=${config}` +
      `&session=spec-${encodeURIComponent(JSON.stringify({ views: [view] }))}` +
      `&renderer=${backend}`
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 })
    await page.waitForSelector(
      '[data-testid="synteny_canvas"][data-display-drawn="true"]',
      { timeout: 120000 },
    )
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLElement>('[data-testid="synteny_canvas"]')
          ?.dataset.displayPhase === 'ready',
      { timeout: 120000 },
    )
    await new Promise(r => setTimeout(r, 3000))
    const el = (await page.$('[data-testid="synteny_canvas"]'))!
    return Buffer.from(await el.screenshot())
  } finally {
    await browser.close()
  }
}

console.log(
  `dataset ${key}, minAlignmentLength ${rest.minAlignmentLength}, ` +
    `autoDiagonalize ${!args.includes('--no-diagonalize')}${
      locs ? `, loc ${locs.join(' / ')}` : ', whole genome'
    }`,
)
for (const drawCurves of modes) {
  const c2d = await capture(drawCurves, 'canvas2d')
  const gl = await capture(drawCurves, 'webgl')
  if (outDir) {
    const tag = drawCurves ? 'curves' : 'straight'
    fs.writeFileSync(path.join(outDir, `${key}-${tag}-canvas2d.png`), c2d)
    fs.writeFileSync(path.join(outDir, `${key}-${tag}-webgl.png`), gl)
  }
  const d = comparePngBuffers(c2d, gl)
  console.log(
    `  drawCurves=${String(drawCurves).padEnd(5)} canvas2d vs webgl: ` +
      `${(d.diffFraction * 100).toFixed(2)}% drift`,
  )
}
server.close()
