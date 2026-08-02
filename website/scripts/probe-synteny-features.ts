#!/usr/bin/env node
/**
 * probe-synteny-features.ts — dump the alignments a LinearSyntenyView spec draws.
 *
 *   node scripts/probe-synteny-features.ts pangenome/hprc_inversion
 *
 * Which records land in a synteny figure is a property of the data plus both
 * views' regions, so a spec that says "this row runs straight through" is a
 * claim about the drawn set. This prints it per level, from the display's own
 * `featureData`, which is what the renderer uploaded.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { specs } from './screenshot-specs.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const PORT = 3347

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { view: { type: 'string' }, settle: { type: 'string' } },
})
const specName = positionals[0]
const viewIndex = Number(values.view ?? 0)
const settle = Number(values.settle ?? 12000)

const spec = specs.find(s => s.name === specName)
if (!spec || spec.mode !== 'url') {
  console.error(`no url-mode spec named "${specName}"`)
  process.exit(1)
}

const server = await createTestServer(PORT, {
  jbrowseWebRoot: testDataRoot,
  repoRoot,
})
const browser = await launch({
  headless: true,
  defaultViewport: {
    width: spec.viewportWidth ?? 1500,
    height: spec.viewportHeight ?? 800,
    deviceScaleFactor: 1,
  },
  executablePath: findChromeExecutable(),
  args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
  protocolTimeout: 1200000,
})
const page = await browser.newPage()
await page.goto(`http://localhost:${PORT}/${spec.url}`, {
  waitUntil: 'domcontentloaded',
  timeout: 300000,
})
await page.waitForSelector('[data-testid="synteny_canvas_done"]', {
  timeout: 300000,
})
await new Promise(r => setTimeout(r, settle))

const dump = await page.evaluate(index => {
  interface Data {
    strands: Int8Array
    starts: Uint32Array
    ends: Uint32Array
    refNames: string[]
    mateStarts: Uint32Array
    mateEnds: Uint32Array
    mateRefNames: string[]
  }
  interface Display {
    type: string
    featureData?: Data
  }
  interface Level {
    tracks?: { displays?: Display[] }[]
  }
  interface View {
    views?: (View & {
      levels?: Level[]
      displayedRegions?: { refName: string; start: number; end: number }[]
    })[]
    levels?: Level[]
  }
  const view = (window as unknown as { JBrowseSession?: View }).JBrowseSession
    ?.views?.[index]
  return {
    rows: (view?.views ?? []).map(v => ({
      regions: (v.displayedRegions ?? []).map(
        r => `${r.refName}:${r.start}-${r.end}`,
      ),
    })),
    levels: (view?.levels ?? []).map(level =>
      (level.tracks ?? []).flatMap(t =>
        (t.displays ?? []).map(d => {
          const f = d.featureData
          return {
            display: d.type,
            features: f
              ? [...f.starts].map((s, i) => ({
                  strand: f.strands[i],
                  ref: `${f.refNames[i]}:${s}-${f.ends[i]}`,
                  mate: `${f.mateRefNames[i]}:${f.mateStarts[i]}-${f.mateEnds[i]}`,
                }))
              : undefined,
          }
        }),
      ),
    ),
  }
}, viewIndex)

console.log(JSON.stringify(dump, null, 2))
await browser.close()
server.close()
