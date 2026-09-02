/* eslint-disable no-console */
// Opens CircularView, SpreadsheetView, SvInspectorView and BreakpointSplitView
// from each surface ADR-099 unified — a flat `?session=spec-` URL, a flat
// `defaultSession` in a config.json, and a snapshot carrying one misspelled
// key — and reads a pixel census off every canvas and every view body rather
// than looking at a screenshot. The two data surfaces must census identically;
// the typo must land on the import form and name the key, on both surfaces.
//
//   node browser-tests/probe-view-launch-surfaces.ts [--filter=circular,bsv] [--out=<dir>]
//
// Readiness is the positive session gate, then the view phases (which is what
// sees `data-view-component-pending` — a lazy view body reads "Loading…" for a
// couple of seconds after `data-app-phase` is already `ready`), then the
// display phases and paint, then the app holding `ready`. No fixed sleep.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  displayPainted,
  encodeSessionSpec,
  findChromeExecutable,
  isBrowserConsoleNoise,
  waitForAppReady,
  waitForAppSettled,
  waitForDisplayPhases,
  waitForDisplaysDone,
  waitForSession,
  waitForViewPhases,
} from '@jbrowse/browser-test-utils'
import { PNG } from 'pngjs'
import puppeteer from 'puppeteer'

import type { ElementHandle, Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const jbrowseWebRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(__dirname, '../../..')
const APP_PORT = 3411
const CONFIG_PORT = 3412
const TIMEOUT = 90_000
const TYPO_TIMEOUT = 30_000

const CHORDS =
  '[data-testid="structuralVariantChordRenderer"] [data-testid^="chord-"]'
const GRID_ROWS = '.MuiDataGrid-row'
const IMPORT_FORM = '[data-testid="import-form"]'
const SPREADSHEET_IMPORT = '[data-testid="open_spreadsheet"]'
const PENDING_MARKERS = [
  '[data-view-component-pending]',
  '[data-view-phase="loading"]',
  '[data-display-phase="loading"]',
  '[data-display-drawn="false"]',
  '[data-testid="loading-overlay"]',
].join(', ')

const testData = (file: string) =>
  `http://localhost:${APP_PORT}/test_data/volvox/${file}`

interface ViewCase {
  name: string
  type: string
  spec: Record<string, unknown>
  typo: Record<string, unknown>
  typoKey: string
  trackIds: string[]
  gateAssembly: boolean
  contentSelector: string
  importFormSelector: string
}

const BSV_PANEL = {
  assembly: 'volvox',
  loc: 'ctgA:1-50000',
  tracks: ['volvox_sv'],
}

const CASES: ViewCase[] = [
  {
    name: 'circular',
    type: 'CircularView',
    spec: { assembly: 'volvox', tracks: ['volvox_sv_test'] },
    typo: { asembly: 'volvox' },
    typoKey: 'asembly',
    trackIds: ['volvox_sv_test'],
    gateAssembly: true,
    contentSelector: CHORDS,
    importFormSelector: IMPORT_FORM,
  },
  {
    name: 'spreadsheet',
    type: 'SpreadsheetView',
    spec: { assembly: 'volvox', uri: testData('volvox.filtered.vcf.gz') },
    typo: { asembly: 'volvox' },
    typoKey: 'asembly',
    trackIds: [],
    gateAssembly: false,
    contentSelector: GRID_ROWS,
    importFormSelector: SPREADSHEET_IMPORT,
  },
  {
    name: 'sv-inspector',
    type: 'SvInspectorView',
    spec: { assembly: 'volvox', uri: testData('volvox.dup.vcf.gz') },
    typo: { asembly: 'volvox' },
    typoKey: 'asembly',
    trackIds: [],
    gateAssembly: false,
    contentSelector: CHORDS,
    importFormSelector: SPREADSHEET_IMPORT,
  },
  {
    name: 'bsv',
    type: 'BreakpointSplitView',
    spec: { views: [BSV_PANEL, BSV_PANEL] },
    typo: { veiws: [BSV_PANEL, BSV_PANEL] },
    typoKey: 'veiws',
    trackIds: ['volvox_sv'],
    gateAssembly: true,
    contentSelector: displayPainted('pileup-display'),
    importFormSelector: IMPORT_FORM,
  },
]

function absolutizeUris(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(absolutizeUris)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === 'uri' && typeof v === 'string' && !/^(https?:)?\//.test(v)
          ? testData(v)
          : absolutizeUris(v),
      ]),
    )
  }
  return value
}

// The volvox assembly and the tracks a case names, lifted out of the fixture
// config with every relative uri made absolute so the derived config can be
// served from a second port, plus the view as a flat defaultSession entry.
function derivedConfig(c: ViewCase, view: Record<string, unknown>) {
  const volvox = JSON.parse(
    fs.readFileSync(
      path.join(jbrowseWebRoot, 'test_data/volvox/config.json'),
      'utf8',
    ),
  ) as { assemblies: unknown[]; tracks: { trackId: string }[] }
  return {
    assemblies: absolutizeUris(volvox.assemblies),
    tracks: absolutizeUris(
      volvox.tracks.filter(t => c.trackIds.includes(t.trackId)),
    ),
    defaultSession: {
      name: 'Probe',
      views: [{ type: c.type, displayName: `${c.type} probe`, ...view }],
    },
  }
}

function serveJson(dir: string, port: number) {
  return new Promise<http.Server>(resolve => {
    const server = http.createServer((req, res) => {
      const file = path.join(dir, path.basename(req.url ?? ''))
      if (fs.existsSync(file)) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(fs.readFileSync(file))
      } else {
        res.writeHead(404)
        res.end()
      }
    })
    server.listen(port, () => {
      resolve(server)
    })
  })
}

interface PixelCensus {
  w: number
  h: number
  nonBg: number
  colors: number
}

function pixelCensus(png: Uint8Array): PixelCensus {
  const { data, width, height } = PNG.sync.read(Buffer.from(png))
  const histogram = new Map<number, number>()
  for (let i = 0; i < data.length; i += 4) {
    const key =
      ((data[i]! >> 4) << 8) | ((data[i + 1]! >> 4) << 4) | (data[i + 2]! >> 4)
    histogram.set(key, (histogram.get(key) ?? 0) + 1)
  }
  const bg = Math.max(...histogram.values())
  return {
    w: width,
    h: height,
    nonBg: width * height - bg,
    colors: histogram.size,
  }
}

async function elementCensus(el: ElementHandle) {
  const box = await el.boundingBox()
  if (!box || box.width < 1 || box.height < 1) {
    return { w: 0, h: 0, nonBg: 0, colors: 0 }
  }
  return pixelCensus(await el.screenshot({ type: 'png' }))
}

interface Census {
  viewPhases: string[]
  chords: number
  rows: number
  pending: number
  canvases: PixelCensus[]
  bodies: PixelCensus[]
}

async function census(page: Page): Promise<Census> {
  const dom = await page.evaluate(
    (chords, rows, pending) => ({
      viewPhases: [...document.querySelectorAll('[data-view-phase]')].map(
        e => e.dataset.viewPhase ?? '',
      ),
      chords: document.querySelectorAll(chords).length,
      rows: document.querySelectorAll(rows).length,
      pending: document.querySelectorAll(pending).length,
    }),
    CHORDS,
    GRID_ROWS,
    PENDING_MARKERS,
  )
  const canvases = []
  for (const el of await page.$$('canvas')) {
    canvases.push(await elementCensus(el))
  }
  const bodies = []
  for (const el of await page.$$('[data-view-phase]')) {
    bodies.push(await elementCensus(el))
  }
  return { ...dom, canvases, bodies }
}

const exactParts = (c: Census) => [
  `phases=${c.viewPhases.join('/')}`,
  `chords=${c.chords}`,
  `rows=${c.rows}`,
  `canvases=${c.canvases.map(p => `${p.w}x${p.h}:${p.nonBg}`).join(',')}`,
]

const censusKey = (c: Census) =>
  [
    ...exactParts(c),
    `bodies=${c.bodies.map(p => `${p.w}x${p.h}:${p.nonBg}`).join(',')}`,
  ].join(' ')

const censusShape = (c: Census) =>
  [
    ...exactParts(c),
    `bodies=${c.bodies.map(p => `${p.w}x${p.h}`).join(',')}`,
  ].join(' ')

// A body pixel count is compared within this fraction and everything else
// exactly. Chrome rasterizes one unchanged CircularView two ways from load to
// load — see VIEW_INIT.md, "Verified in a browser" — and the gap is three
// orders of magnitude under a dropped chord or a dropped label.
const bodyTolerance = 0.001

function sameCensus(a: Census, b: Census) {
  return (
    censusShape(a) === censusShape(b) &&
    a.bodies.every((p, i) => {
      const q = b.bodies[i]
      return (
        q !== undefined &&
        Math.abs(p.nonBg - q.nonBg) <=
          bodyTolerance * Math.max(p.nonBg, q.nonBg)
      )
    })
  )
}

interface PageLog {
  console: string[]
  errors: string[]
}

function attachLog(page: Page): PageLog {
  const log: PageLog = { console: [], errors: [] }
  page.on('console', msg => {
    const text = msg.text()
    if (
      (msg.type() === 'warn' || msg.type() === 'error') &&
      !isBrowserConsoleNoise(text)
    ) {
      log.console.push(`[${msg.type()}] ${text}`)
    }
  })
  page.on('pageerror', err => {
    log.errors.push(String(err))
  })
  return log
}

async function pageState(page: Page) {
  return page.evaluate(pending => {
    const session = (
      globalThis as {
        JBrowseSession?: {
          views?: { type?: string }[]
          snackbarMessages?: { message: string; level?: string }[]
        }
      }
    ).JBrowseSession
    return {
      appPhase:
        document.querySelector('[data-app-phase]')?.dataset.appPhase ??
        'absent',
      viewPhases: [...document.querySelectorAll('[data-view-phase]')].map(
        e => e.dataset.viewPhase ?? '',
      ),
      pending: [...document.querySelectorAll(pending)].map(e =>
        [...e.attributes]
          .filter(a => a.name.startsWith('data-'))
          .map(a => `${a.name}=${a.value}`)
          .join(' '),
      ),
      viewTypes: (session?.views ?? []).map(v => v.type ?? '?'),
      snackbar: (session?.snackbarMessages ?? []).map(
        m => `${m.level ?? 'info'}: ${m.message}`,
      ),
    }
  }, PENDING_MARKERS)
}

async function settle(page: Page, c: ViewCase) {
  const t0 = Date.now()
  if (!(await waitForAppReady(page, { timeout: TIMEOUT }))) {
    throw new Error('the app never published data-app-phase="ready"')
  }
  await waitForSession(page, {
    assembly: c.gateAssembly ? 'volvox' : undefined,
    trackIds: c.trackIds,
    timeout: TIMEOUT,
  })
  await waitForViewPhases(page, TIMEOUT)
  await page.waitForSelector(c.contentSelector, { timeout: TIMEOUT })
  const phases = await waitForDisplayPhases(page, TIMEOUT)
  const drawn = await waitForDisplaysDone(page, TIMEOUT)
  const held = await waitForAppSettled(page, { timeout: TIMEOUT })
  return { ms: Date.now() - t0, phases, drawn, held }
}

interface Result {
  view: string
  surface: string
  ok: boolean
  detail: string
  census?: Census
}

async function driveData(
  page: Page,
  c: ViewCase,
  surface: string,
  url: string,
): Promise<Result> {
  const log = attachLog(page)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
  try {
    const waits = await settle(page, c)
    const result = await census(page)
    const ok =
      result.pending === 0 &&
      result.viewPhases.length > 0 &&
      result.viewPhases.every(p => p !== 'loading') &&
      log.errors.length === 0
    return {
      view: c.name,
      surface,
      ok,
      detail: `${censusKey(result)} waits=${JSON.stringify(waits)} console=${JSON.stringify(log.console)} errors=${JSON.stringify(log.errors)}`,
      census: result,
    }
  } catch (e) {
    const state = await pageState(page).catch(() => undefined)
    return {
      view: c.name,
      surface,
      ok: false,
      detail: `${String(e)} state=${JSON.stringify(state)} console=${JSON.stringify(log.console)} errors=${JSON.stringify(log.errors)}`,
    }
  }
}

async function driveTypo(
  page: Page,
  c: ViewCase,
  surface: string,
  url: string,
): Promise<Result> {
  const log = attachLog(page)
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })
  const ready = await waitForAppReady(page, { timeout: TYPO_TIMEOUT })
  const form = await page
    .waitForSelector(c.importFormSelector, { timeout: TYPO_TIMEOUT })
    .then(() => true)
    .catch(() => false)
  const quiet = await page
    .waitForFunction(
      pending => document.querySelector(pending) === null,
      { timeout: TYPO_TIMEOUT },
      PENDING_MARKERS,
    )
    .then(() => true)
    .catch(() => false)
  const state = await pageState(page)
  const expected = `ignored unknown key(s): ${c.typoKey}`
  const named =
    state.snackbar.some(m => m.includes(expected)) ||
    log.console.some(m => m.includes(expected))
  // A spec never becomes a snapshot, so its launcher gets the typo'd object
  // and may refuse it outright ("No assembly provided") after the key has been
  // named — no view, two errors, no hang. That is the policy LGV set, so a
  // spec-url typo passes on the report alone; only the snapshot surface has to
  // land on the form.
  const landed =
    form || (surface.endsWith('spec-url') && !state.viewTypes.length)
  const ok = ready && landed && quiet && named && log.errors.length === 0
  return {
    view: c.name,
    surface,
    ok,
    detail: `ready=${ready} importForm=${form} views=${state.viewTypes.length} quiet=${quiet} keyNamed=${named} ms=${Date.now() - t0} state=${JSON.stringify(state)} console=${JSON.stringify(log.console)} errors=${JSON.stringify(log.errors)}`,
  }
}

function specUrl(c: ViewCase, view: Record<string, unknown>) {
  const spec = encodeSessionSpec({
    views: [{ type: c.type, displayName: `${c.type} probe`, ...view }],
  })
  return `http://localhost:${APP_PORT}/?config=test_data/volvox/config.json&session=${spec}&sessionName=Probe`
}

function configUrl(name: string) {
  return `http://localhost:${APP_PORT}/?config=http://localhost:${CONFIG_PORT}/${name}.json`
}

async function main() {
  const args = process.argv.slice(2)
  const filter = args
    .find(a => a.startsWith('--filter='))
    ?.slice('--filter='.length)
    .split(',')
  const outDir =
    args.find(a => a.startsWith('--out='))?.slice('--out='.length) ??
    path.join(repoRoot, '.probe-view-launch-surfaces')
  fs.mkdirSync(outDir, { recursive: true })
  const cases = CASES.filter(c => !filter || filter.includes(c.name))

  const app = await createTestServer(APP_PORT, { jbrowseWebRoot, repoRoot })
  const configs = await serveJson(outDir, CONFIG_PORT)
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: findChromeExecutable(),
    args: BASE_CHROME_ARGS,
  })
  const results: Result[] = []
  try {
    for (const c of cases) {
      for (const [name, view] of [
        [`${c.name}-default`, c.spec],
        [`${c.name}-typo`, c.typo],
      ] as const) {
        fs.writeFileSync(
          path.join(outDir, `${name}.json`),
          JSON.stringify(derivedConfig(c, view), null, 2),
        )
      }
      const runs: [string, (p: Page) => Promise<Result>][] = [
        ['spec-url', p => driveData(p, c, 'spec-url', specUrl(c, c.spec))],
        [
          'defaultSession',
          p =>
            driveData(p, c, 'defaultSession', configUrl(`${c.name}-default`)),
        ],
        [
          'typo-defaultSession',
          p =>
            driveTypo(p, c, 'typo-defaultSession', configUrl(`${c.name}-typo`)),
        ],
        [
          'typo-spec-url',
          p => driveTypo(p, c, 'typo-spec-url', specUrl(c, c.typo)),
        ],
      ]
      for (const [surface, run] of runs) {
        const page = await browser.newPage()
        await page.setViewport({ width: 1400, height: 900 })
        console.log(`--- ${c.name} / ${surface}`)
        const result = await run(page)
        await page.screenshot({
          path: path.join(outDir, `${c.name}-${surface}.png`),
        })
        await page.close()
        console.log(`${result.ok ? 'ok  ' : 'FAIL'} ${result.detail}`)
        results.push(result)
      }
      const spec = results.find(
        r => r.view === c.name && r.surface === 'spec-url',
      )?.census
      const config = results.find(
        r => r.view === c.name && r.surface === 'defaultSession',
      )?.census
      const same = !!spec && !!config && sameCensus(spec, config)
      results.push({
        view: c.name,
        surface: 'spec-url == defaultSession',
        ok: same,
        detail: same
          ? censusKey(spec)
          : `spec-url: ${spec ? censusKey(spec) : 'no census'}\n       defaultSession: ${config ? censusKey(config) : 'no census'}`,
      })
    }
  } finally {
    await browser.close()
    app.close()
    configs.close()
  }
  fs.writeFileSync(
    path.join(outDir, 'results.json'),
    JSON.stringify(results, null, 2),
  )
  console.log('\nview          surface                      result')
  for (const r of results) {
    console.log(
      `${r.view.padEnd(13)} ${r.surface.padEnd(28)} ${r.ok ? 'ok' : 'FAIL'}`,
    )
  }
  console.log(`\ndetails: ${path.join(outDir, 'results.json')}`)
  process.exitCode = results.every(r => r.ok) ? 0 : 1
}

await main()
