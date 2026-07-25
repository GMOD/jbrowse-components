// Throwaway: interleaved A/B of two prebuilt jbrowse-web `build/` trees —
// startup timings, program-compile counts, and a pixel diff of the settled view.
//
//   node scripts/ab-compare.ts --a=<rootA> --b=<rootB> [--runs=5] [--tracks=…]
//                              [--configA=…] [--configB=…] [--out=<dir>]
//
// Each root must contain `build/` and `test_data/` (a symlink is fine).
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
  delay,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForLoadingComplete,
  waitForQuiescent,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { VOLVOX, lgvSession } from './screenshot-spec-helpers.ts'

const VOLVOX_DEFAULT = VOLVOX

import type { Browser } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')

const arg = (name: string, fallback: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const rootA = arg('a', '')
const rootB = arg('b', '')
const runs = Number(arg('runs', '5'))
const outDir = arg('out', '/tmp')
const loc = arg('loc', 'ctgA:1-20,000')
const configA = arg('configA', VOLVOX_DEFAULT)
const configB = arg('configB', VOLVOX_DEFAULT)
const tracks = arg(
  'tracks',
  'volvox_alignments,gff3tabix_genes,volvox_microarray',
).split(',')
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1 }

interface Result {
  toViewMs: number
  toSettledMs: number
  programs: number
  statusMs: number
}

async function once(
  browser: Browser,
  port: number,
  config: string,
  shot?: string,
): Promise<Result> {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    const p = { programs: 0, statusMs: 0 }
    ;(window as unknown as { __ab: typeof p }).__ab = p
    const gl2 = WebGL2RenderingContext.prototype
    const origLink = gl2.linkProgram
    gl2.linkProgram = function (this: WebGL2RenderingContext, prog) {
      p.programs++
      origLink.call(this, prog)
    }
    const orig = gl2.getProgramParameter
    gl2.getProgramParameter = function (this: WebGL2RenderingContext, prog, n) {
      const t0 = performance.now()
      const r = orig.call(this, prog, n)
      p.statusMs += performance.now() - t0
      return r
    }
  })
  const url = `http://localhost:${port}/${lgvSession(config, {
    assembly: 'volvox',
    loc,
    tracks,
  })}`
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('[data-testid="zoom_in"]', { timeout: 60000 })
  const toViewMs = Date.now() - t0
  await waitForLoadingComplete(page, { timeout: 60000, waitForDownloads: true })
  await waitForDisplayPhases(page, 60000)
  await waitForDisplaysDone(page, 60000)
  await waitForQuiescent(page, { timeout: 60000 })
  const toSettledMs = Date.now() - t0
  const probe = (await page.evaluate(
    () => (window as unknown as { __ab: { programs: number; statusMs: number } }).__ab,
  ))
  if (shot) {
    // settle any trailing paint so the two captures compare like for like
    await delay(2000)
    await page.screenshot({ path: shot })
  }
  await page.close()
  return { toViewMs, toSettledMs, ...probe }
}

const median = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0

async function main() {
  if (!rootA || !rootB) {
    throw new Error('need --a=<root> --b=<root>')
  }
  const servers = [
    await createTestServer(3351, { jbrowseWebRoot: rootA, repoRoot }),
    await createTestServer(3352, { jbrowseWebRoot: rootB, repoRoot }),
  ]
  const browser = await launch({
    headless: true,
    defaultViewport: VIEWPORT,
    executablePath: findChromeExecutable(),
    args: [...BASE_CHROME_ARGS, '--use-angle=gl'],
  })
  const results: Record<string, Result[]> = { a: [], b: [] }
  try {
    // interleaved so machine-load drift hits both arms equally
    for (let i = 0; i < runs; i++) {
      results.a!.push(
        await once(browser, 3351, configA, i === 0 ? `${outDir}/shot-a.png` : undefined),
      )
      results.b!.push(
        await once(browser, 3352, configB, i === 0 ? `${outDir}/shot-b.png` : undefined),
      )
      process.stderr.write(`run ${i + 1}/${runs}\n`)
    }
  } finally {
    await browser.close()
    for (const s of servers) {
      s.close()
    }
  }
  for (const [k, root] of [
    ['a', rootA],
    ['b', rootB],
  ] as const) {
    const rs = results[k]!
    process.stderr.write(
      `${k} (${root})\n` +
        `  nav→view    median ${median(rs.map(r => r.toViewMs))} ms  ${rs.map(r => r.toViewMs).join(' ')}\n` +
        `  nav→settled median ${median(rs.map(r => r.toSettledMs))} ms  ${rs.map(r => r.toSettledMs).join(' ')}\n` +
        `  programs linked ${rs.map(r => r.programs).join(' ')}\n` +
        `  link-status ms  median ${median(rs.map(r => r.statusMs)).toFixed(0)}\n`,
    )
  }
  const shots = [`${outDir}/shot-a.png`, `${outDir}/shot-b.png`]
  if (shots.every(s => fs.existsSync(s))) {
    const out = execFileSync(
      'compare',
      ['-metric', 'AE', ...shots, `${outDir}/shot-diff.png`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    process.stderr.write(`pixel diff (AE): ${out}\n`)
  }
}

main().catch((err: unknown) => {
  // ImageMagick `compare` exits non-zero when images differ; surface its stderr
  const e = err as { stderr?: Buffer | string; message?: string }
  process.stderr.write(
    `pixel diff / error: ${String(e.stderr ?? e.message ?? err)}\n`,
  )
})
