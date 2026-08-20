/* eslint-disable no-console */
// How many ribbons an SVG export actually draws as a 1px centerline stroke
// rather than as a filled silhouette, and therefore how big `N` is in the parked
// item this exists to price: agent-docs/TODO.md §"Canvas2D fades a curved
// sub-pixel ribbon by one number".
//
// That item's own "first move if it is picked up" is *decide it on the SVG
// export, not the canvas* — closing the fade gap means replacing one
// `ctx.stroke()` of the centerline with N segments at N alphas, which is
// unaffordable in the interactive loop at 500k instances and may be trivial in
// an export, where culling has already run. It is unaffordable or trivial
// depending on a number nobody had measured. This measures it.
//
// The two branches are distinguishable in the markup without instrumenting
// anything: SvgCanvas emits `fill="none"` for a stroke and `stroke="none"` for a
// fill, and the synteny ribbons are the only thing in the level's group.
//
// ONLY IF THE EXPORT IS VECTOR, and by default it is not — the dialog's
// "Rasterize canvas based tracks?" defaults to on, and `renderSvg` then sends the
// whole level through a 2x raster `PaintLayer` instead of `SvgCanvas`. The
// default export of a whole-genome hs1/mm39 view is 2 paths and one 3.7MB
// base64 PNG. So `--vector` unchecks it, and the counts below are the figure
// author's case rather than the default one.
//
//   --loc=<a>,<b>   zoom the two rows (default: whole genomes)
//   --dataset=hs1|grape
//   --straight      drawCurves off (default on)
//   --vector        uncheck "Rasterize canvas based tracks?", so the ribbons
//                   come out as paths and can be counted at all
//   --out=<file>    also write the exported SVG
import fs from 'node:fs'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

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
const locs = arg('loc')?.split(',')
const outFile = arg('out')

const { server, port } = await startServerOnFreePort(3211)

const view = {
  type: 'LinearSyntenyView',
  ...rest,
  views: rest.views.map((v, i) => (locs?.[i] ? { ...v, loc: locs[i] } : v)),
  drawCurves: !args.includes('--straight'),
  autoDiagonalize: !args.includes('--no-diagonalize'),
  colorBy: 'query',
  alpha: 0.4,
  levelHeights: [350],
}

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--disable-gpu'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 800 })
  const client = await page.createCDPSession()
  const downloadPath = fs.mkdtempSync('/tmp/jb-svg-branches-')
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath,
  })
  await page.goto(
    `http://localhost:${port}/?config=${config}` +
      `&session=spec-${encodeURIComponent(JSON.stringify({ views: [view] }))}` +
      '&renderer=canvas2d',
    { waitUntil: 'networkidle0', timeout: 120000 },
  )
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

  // The export dialog, by the same path svg-export.ts drives it.
  await (await page.waitForSelector('[data-testid="view_menu_icon"]'))!.click()
  await page.waitForFunction(() =>
    [...document.querySelectorAll('*')].some(
      e => e.textContent === 'Export SVG',
    ),
  )
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      e => e.textContent === 'Export SVG',
    )
    ;(el as HTMLElement | undefined)?.click()
  })
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some(
      b => b.textContent === 'Submit',
    ),
  )
  if (args.includes('--vector')) {
    const unchecked = await page.evaluate(() => {
      const label = [...document.querySelectorAll('label')].find(l =>
        l.textContent.startsWith('Rasterize canvas based tracks?'),
      )
      const box = label?.querySelector<HTMLInputElement>('input[type=checkbox]')
      if (!box?.checked) {
        return false
      }
      box.click()
      return true
    })
    if (!unchecked) {
      throw new Error('could not uncheck rasterize — is the box already off?')
    }
  }
  await page.evaluate(() => {
    ;[...document.querySelectorAll('button')]
      .find(b => b.textContent === 'Submit')
      ?.click()
  })

  const svgPath = `${downloadPath}/jbrowse.svg`
  const start = Date.now()
  while (!fs.existsSync(svgPath)) {
    if (Date.now() - start > 60000) {
      throw new Error('SVG export timed out')
    }
    await new Promise(r => setTimeout(r, 200))
  }
  const svg = fs.readFileSync(svgPath, 'utf8')
  if (outFile) {
    fs.writeFileSync(outFile, svg)
  }
  fs.rmSync(downloadPath, { recursive: true, force: true })

  const paths = svg.match(/<path\b[^>]*>/g) ?? []
  const stroked = paths.filter(p => p.includes('fill="none"')).length
  const filled = paths.filter(p => p.includes('stroke="none"')).length
  console.log(
    `dataset ${key}, ${view.drawCurves ? 'curves' : 'straight'}, ` +
      (locs ? `loc ${locs.join(' / ')}` : 'whole genome') +
      (args.includes('--vector') ? ', vector' : ', rasterized (the default)'),
  )
  console.log(`  <path> total          ${paths.length}`)
  console.log(`  centerline strokes N  ${stroked}   <- the parked item's N`)
  console.log(`  filled silhouettes    ${filled}`)
  console.log(
    `  <image> (rasterized)  ${(svg.match(/<image\b/g) ?? []).length}`,
  )
  console.log(`  svg size              ${(svg.length / 1024).toFixed(0)}KB`)
} finally {
  await browser.close()
  server.close()
}
