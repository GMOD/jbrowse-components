/* eslint-disable no-console */
// One-off probe (not a suite): read the bisulfite coverage band's methylated
// bar heights off the real app, for the shipped arabidopsis EM-seq config, with
// "show unmethylated" (twoColor) off and then on. The two runs must agree — the
// unmethylated state is a painting choice and must not move the methylated bar.
//
//   node products/jbrowse-web/browser-tests/bisulfite-coverage-probe.ts [outdir]
import fs from 'node:fs'
import path from 'node:path'

import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import { launch } from 'puppeteer'

import {
  findByTestId,
  navigateToUrl,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const outDir = process.argv[2] ?? '/tmp/bisulfite-probe'
const CONFIG = 'test_data/arabidopsis_methylation/config_emseq_bisulfite.json'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)
fs.mkdirSync(outDir, { recursive: true })

const browser = await launch({
  headless: true,
  args: [...BASE_CHROME_ARGS, '--window-size=1400,900'],
  defaultViewport: { width: 1400, height: 900 },
})

// The methylated segment is the 5mC red; the unmethylated one is blue. Count a
// pixel as methylated when red clearly dominates.
function isMethRed(r: number, g: number, b: number, a: number) {
  return a > 200 && r > 120 && r > g + 50 && r > b + 50
}

// Per screen column, the tallest run of methylated red inside the coverage
// band, as a fraction of the band. That is the drawn methylation level.
function barHeights(png: PNG, bandHeight: number) {
  const out = new Map<number, number>()
  for (let x = 0; x < png.width; x++) {
    let count = 0
    for (let y = 0; y < Math.min(bandHeight, png.height); y++) {
      const i = (png.width * y + x) * 4
      if (
        isMethRed(
          png.data[i]!,
          png.data[i + 1]!,
          png.data[i + 2]!,
          png.data[i + 3]!,
        )
      ) {
        count++
      }
    }
    if (count > 0) {
      out.set(x, count)
    }
  }
  return out
}

function summarize(label: string, heights: Map<number, number>) {
  const vals = [...heights.values()].sort((a, b) => a - b)
  const distinct = new Set(vals)
  console.log(
    `${label}: ${vals.length} columns with a methylated bar, ` +
      `${distinct.size} distinct heights, min=${vals[0]} max=${vals.at(-1)} ` +
      `median=${vals[Math.floor(vals.length / 2)]}`,
  )
  return vals
}

try {
  const page = await browser.newPage()
  await navigateToUrl(page, `config=${CONFIG}`)
  await findByTestId(page, 'pileup-display', 120000)
  await waitForDataLoaded(page, 120000)

  // Base-level zoom, so one cytosine owns several screen columns. At the
  // config's own 14kb window each column packs ~10 genomic positions and
  // neighbouring bars blend into it, which is a property of the raster and not
  // of the height arithmetic.
  await page.evaluate(async () => {
    const view = (window as any).JBrowseSession?.views?.[0]
    await view?.navToLocString('NC_003070.9:4,404,000-4,405,200')
  })
  await waitForDataLoaded(page, 120000)

  const bandHeight = await page.evaluate(() => {
    const view = (window as any).JBrowseSession?.views?.[0]
    const track = view?.tracks?.find((t: any) =>
      t.configuration.trackId.includes('wgbs'),
    )
    const display = track?.displays?.[0]
    return display?.coverageHeight ?? 100
  })
  console.log(`coverage band height: ${bandHeight}px`)

  // Changing the color scheme starts a refetch, and every readiness signal the
  // app publishes is negative — so a wait armed before the refetch has begun is
  // already satisfied and screenshots a blank canvas. Shoot until two
  // consecutive frames match and the frame is not blank.
  const shoot = async (name: string) => {
    const grab = async () => {
      const el = await page.$('[data-testid="pileup-display"] canvas')
      return (await el!.screenshot()) as Buffer
    }
    let prev = await grab()
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000))
      const next = await grab()
      const png = PNG.sync.read(next)
      const painted = barHeights(png, png.height).size > 0
      if (painted && next.equals(prev)) {
        fs.writeFileSync(path.join(outDir, `${name}.png`), next)
        return png
      }
      prev = next
    }
    throw new Error(`${name}: canvas never settled on a painted frame`)
  }

  const singleColor = barHeights(await shoot('single-color'), bandHeight)
  const single = summarize('twoColor OFF (shipped default)', singleColor)

  await page.evaluate(() => {
    const view = (window as any).JBrowseSession?.views?.[0]
    const track = view?.tracks?.find((t: any) =>
      t.configuration.trackId.includes('wgbs'),
    )
    track?.displays?.[0]?.setColorScheme({
      type: 'bisulfite',
      modifications: { twoColor: true },
    })
  })
  await waitForDataLoaded(page, 120000)

  const twoColorPng = await shoot('two-color')
  const twoColor = barHeights(twoColorPng, bandHeight)
  const two = summarize('twoColor ON', twoColor)

  const shared = [...singleColor.keys()].filter(x => twoColor.has(x))
  const diffs = shared.map(x =>
    Math.abs(singleColor.get(x)! - twoColor.get(x)!),
  )
  const maxDiff = Math.max(0, ...diffs)
  const disagreeing = diffs.filter(d => d > 1).length
  console.log(
    `shared columns: ${shared.length}, max height difference: ${maxDiff}px, ` +
      `columns differing by >1px: ${disagreeing}`,
  )
  console.log(
    `full-height columns (bar fills the band): OFF ${single.filter(v => v >= bandHeight - 1).length}, ` +
      `ON ${two.filter(v => v >= bandHeight - 1).length}`,
  )

  await page.screenshot({ path: path.join(outDir, 'fullpage.png') })
} finally {
  await browser.close()
  server.close()
}
