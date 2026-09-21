/* eslint-disable no-console */
// Whether an alignments display's GLSL text sits on the path to its first paint
// over a throttled network, pinned to WebGL2.
//
//   pnpm --filter @jbrowse/web build
//   PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome \
//     node products/jbrowse-web/browser-tests/shader-text-first-paint-probe.ts
//
// Times, from navigation, when the last GLSL chunk, the last data request and
// the first painted display arrive. A GLSL chunk is a script whose text holds
// `#version 300 es`. If the text lands before the data, grouping it into fewer
// chunks cannot move first paint. Rewrites the rows of
// agent-docs/measurements/shader-text-first-paint.json, each the median of three
// sittings.
import fs from 'node:fs'
import path from 'node:path'

import {
  BASE_CHROME_ARGS,
  encodeSessionSpec,
} from '@jbrowse/browser-test-utils'
import { PredefinedNetworkConditions, launch } from 'puppeteer'

import { startServerOnFreePort } from './server.ts'

const CONDITIONS = ['Fast 4G', 'Slow 4G'] as const
const RUNS = 3

const { server, port } = await startServerOnFreePort(3000)
const spec = {
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1000-6000',
      tracks: ['volvox_alignments_pileup_coverage'],
    },
  ],
}
const url = `http://localhost:${port}/?config=test_data/volvox/config.json&session=${encodeSessionSpec(spec)}&sessionName=P&renderer=webgl`

const glslByUrl = new Map<string, boolean>()
async function isGlsl(chunk: string) {
  let known = glslByUrl.get(chunk)
  if (known === undefined) {
    known = (await (await fetch(chunk)).text()).includes('#version 300 es')
    glslByUrl.set(chunk, known)
  }
  return known
}

async function sitting(condition: (typeof CONDITIONS)[number]) {
  const browser = await launch({ headless: true, args: BASE_CHROME_ARGS })
  try {
    const page = await browser.newPage()
    await page.emulateNetworkConditions(PredefinedNetworkConditions[condition])
    let painted = 0
    const t0 = Date.now()
    await page.exposeFunction('__painted', () => {
      painted ||= Date.now() - t0
    })
    await page.evaluateOnNewDocument(() => {
      new MutationObserver((_, observer) => {
        if (document.querySelector('[data-display-drawn="true"]')) {
          observer.disconnect()
          ;(window as any).__painted()
        }
      }).observe(document, {
        subtree: true,
        attributes: true,
        childList: true,
      })
    })
    const finished: { url: string; at: number }[] = []
    page.on('requestfinished', r => {
      finished.push({ url: r.url(), at: Date.now() - t0 })
    })
    await page.goto(url, { waitUntil: 'load', timeout: 300_000 })
    await page.waitForFunction(
      'window.__painted && document.querySelector(\'[data-display-drawn="true"]\')',
      { timeout: 300_000 },
    )
    await new Promise(r => setTimeout(r, 500))

    let lastGlsl = 0
    let glsl = 0
    let lastData = 0
    for (const { url: u, at } of finished) {
      if (/\.js([?#]|$)/.test(u)) {
        if (await isGlsl(u)) {
          glsl++
          lastGlsl = Math.max(lastGlsl, at)
        }
      } else if (/\.(bam|bai|cram|crai|fa|fai|gz|gzi|2bit)([?#]|$)/.test(u)) {
        lastData = Math.max(lastData, at)
      }
    }
    return { glsl, lastGlsl, lastData, painted }
  } finally {
    await browser.close()
  }
}

const median = (values: number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!

try {
  const rows = []
  for (const condition of CONDITIONS) {
    const sittings = []
    for (let i = 0; i < RUNS; i++) {
      const r = await sitting(condition)
      console.log(
        `${condition}: ${r.glsl} GLSL chunks, last at ${r.lastGlsl} ms; last data at ${r.lastData} ms; first paint ${r.painted} ms`,
      )
      sittings.push(r)
    }
    rows.push({
      values: {
        network: condition,
        glslChunks: sittings[0]!.glsl,
        lastGlslMs: median(sittings.map(r => r.lastGlsl)),
        lastDataMs: median(sittings.map(r => r.lastData)),
        firstPaintMs: median(sittings.map(r => r.painted)),
      },
    })
  }
  const record = path.resolve(
    'agent-docs/measurements/shader-text-first-paint.json',
  )
  const existing = JSON.parse(fs.readFileSync(record, 'utf8'))
  existing.measured = new Date().toISOString().slice(0, 10)
  existing.rows = rows
  fs.writeFileSync(record, `${JSON.stringify(existing, null, 2)}\n`)
} finally {
  server.close()
}
