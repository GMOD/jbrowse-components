#!/usr/bin/env node
/**
 * snapshot.ts — a minimal, framework-agnostic page snapshotter.
 *
 *   launch → goto → wait-for-ready → (annotate) → screenshot → optimize →
 *   content-stable commit (only rewrites the PNG when it actually changed)
 *
 * No JBrowse coupling: it imports only ./image-pipeline.ts and ./annotations.ts,
 * both self-contained, so this file could move into its own package as-is. Point
 * it at any URL. `generate-screenshots.ts` is the heavier JBrowse-doc pipeline
 * built on the same two primitives; this is the small reusable core of it.
 *
 * Needs the `compare`/`identify` (ImageMagick) binaries on PATH for the diff
 * gate; `pngquant` is optional (image optimization is skipped without it).
 *
 * Usage:
 *   node --experimental-strip-types snapshot.ts --url https://example.com --out shot.png
 *   node --experimental-strip-types snapshot.ts --url http://localhost:3000 \
 *     --out home.png --wait-selector "#app" --width 1500 --height 800 --scale 2
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { launch } from 'puppeteer'

import { drawAnnotations } from './annotations.ts'
import { commitScreenshot, optimizePng } from './image-pipeline.ts'

import type { CommitResult } from './image-pipeline.ts'
import type { Annotation } from './screenshot-spec-types.ts'
import type { Page, PuppeteerLifeCycleEvent, Viewport } from 'puppeteer'

const DEFAULT_DIFF_THRESHOLD = 0.005
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_SETTLE_MS = 250

export interface SnapshotSpec {
  // basename of the committed PNG (without .png)
  name: string
  url: string
  // wait for this CSS selector to be visible before capture
  waitForSelector?: string
  // wait for an element with this visible text before capture
  waitForText?: string
  // goto lifecycle to await (default: 'networkidle0')
  waitUntil?: PuppeteerLifeCycleEvent
  // capture viewport (default 1500x800 @2x)
  viewport?: Viewport
  // capture only this CSS-px rect instead of the whole page
  crop?: { x: number; y: number; width: number; height: number }
  // SVG callouts (arrows/boxes/text) drawn over the page before capture
  annotations?: Annotation[]
  // extra settle after ready before capture (default 250ms)
  settleMs?: number
  // per-wait timeout (default 30s)
  timeout?: number
  // per-spec override of the content-stable diff gate
  diffThreshold?: number
}

export interface SnapshotOptions {
  outDir?: string
  force?: boolean
  diffThreshold?: number
  headed?: boolean
  // executablePath override; defaults to puppeteer's bundled browser
  chromePath?: string
  // extra chrome flags (e.g. software-WebGL); merged with a sane default set
  chromeArgs?: string[]
  concurrency?: number
}

const DEFAULT_VIEWPORT: Viewport = {
  width: 1500,
  height: 800,
  deviceScaleFactor: 2,
}
// software WebGL so canvas/GL pages still render under headless
const DEFAULT_CHROME_ARGS = ['--enable-unsafe-swiftshader']

const textSelector = (text: string) => `::-p-text(${text})`

// Two chained rAFs guarantee a frame has committed to the compositor; a short
// trailing timeout gives a freshly-composited layer (e.g. a just-opened popper)
// a beat to rasterize before we capture.
async function settle(page: Page, ms: number) {
  await page.evaluate(
    settleMs =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, settleMs)
          })
        })
      }),
    ms,
  )
}

async function waitForReady(page: Page, spec: SnapshotSpec) {
  const timeout = spec.timeout ?? DEFAULT_TIMEOUT_MS
  const selectors = [
    spec.waitForSelector,
    spec.waitForText ? textSelector(spec.waitForText) : undefined,
  ].filter((s): s is string => s !== undefined)
  for (const selector of selectors) {
    await page.waitForSelector(selector, { visible: true, timeout })
  }
  await settle(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
}

// Drive one prepared page through a spec and leave a finished, optimized PNG in
// a temp file. Caller decides whether to commit or diff it.
export async function captureToTemp(page: Page, spec: SnapshotSpec) {
  await page.goto(spec.url, {
    waitUntil: spec.waitUntil ?? 'networkidle0',
    timeout: Math.max(spec.timeout ?? DEFAULT_TIMEOUT_MS, 60000),
  })
  await waitForReady(page, spec)
  if (spec.annotations && spec.annotations.length > 0) {
    await drawAnnotations(page, spec.annotations)
    await settle(page, spec.settleMs ?? DEFAULT_SETTLE_MS)
  }
  const tmp = path.join(
    os.tmpdir(),
    `snapshot-${process.pid}-${spec.name.replaceAll('/', '_')}.png`,
  )
  await page.screenshot(
    spec.crop ? { path: tmp, clip: spec.crop } : { path: tmp },
  )
  optimizePng(tmp)
  return tmp
}

function launchOptions(opts: SnapshotOptions) {
  // Fall back to a system Chrome via the standard env vars when no explicit
  // path is given, so this works without puppeteer's bundled browser installed.
  const executablePath =
    opts.chromePath ??
    process.env.CHROME_PATH ??
    process.env.PUPPETEER_EXECUTABLE_PATH
  return {
    headless: !opts.headed,
    defaultViewport: DEFAULT_VIEWPORT,
    args: [...DEFAULT_CHROME_ARGS, ...(opts.chromeArgs ?? [])],
    ...(executablePath ? { executablePath } : {}),
  }
}

// Snapshot one spec end-to-end with its own fresh browser.
export async function snapshot(
  spec: SnapshotSpec,
  opts: SnapshotOptions = {},
): Promise<CommitResult> {
  const browser = await launch(launchOptions(opts))
  try {
    const page = await browser.newPage()
    if (spec.viewport) {
      await page.setViewport(spec.viewport)
    }
    const tmp = await captureToTemp(page, spec)
    const outDir = opts.outDir ?? '.'
    const outputPath = path.join(outDir, `${spec.name}.png`)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    return commitScreenshot(tmp, outputPath, spec.name, {
      force: opts.force ?? false,
      diffThreshold:
        spec.diffThreshold ?? opts.diffThreshold ?? DEFAULT_DIFF_THRESHOLD,
    })
  } finally {
    await browser.close()
  }
}

// Snapshot many specs with a fixed-size pool of concurrent browsers.
export async function snapshotAll(
  specs: SnapshotSpec[],
  opts: SnapshotOptions = {},
) {
  const concurrency = opts.concurrency ?? 4
  const queue = [...specs]
  const results: { name: string; result: CommitResult }[] = []
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const spec = queue.shift()!
      const result = await snapshot(spec, opts)
      results.push({ name: spec.name, result })
    }
  })
  await Promise.all(workers)
  return results
}

const CLI_HELP = `snapshot — capture a web page to a content-stable PNG

Usage: node --experimental-strip-types snapshot.ts --url <url> --out <file.png> [options]

Options:
  --url <url>            Page to capture (required)
  --out <file.png>       Output path (required)
  --wait-selector <css>  Wait for this CSS selector before capture
  --wait-text <text>     Wait for this visible text before capture
  --width <n>            Viewport width (default 1500)
  --height <n>           Viewport height (default 800)
  --scale <n>            deviceScaleFactor (default 2)
  --settle <ms>          Extra settle before capture (default 250)
  --diff-threshold <f>   Pixel-diff fraction below which the existing PNG is
                         kept unchanged (default 0.005)
  --force                Overwrite the PNG even if unchanged
  --headed               Run a visible browser
  --chrome <path>        Browser executable (default: puppeteer's bundled one)
  -h, --help             Show this help
`

async function cli() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      help: { type: 'boolean', short: 'h', default: false },
      url: { type: 'string' },
      out: { type: 'string' },
      'wait-selector': { type: 'string' },
      'wait-text': { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      scale: { type: 'string' },
      settle: { type: 'string' },
      'diff-threshold': { type: 'string' },
      force: { type: 'boolean', default: false },
      headed: { type: 'boolean', default: false },
      chrome: { type: 'string' },
    },
  })
  if (values.help || !values.url || !values.out) {
    console.log(CLI_HELP)
    process.exit(values.help ? 0 : 1)
  }
  const num = (raw: string | undefined) => {
    const n = raw ? Number(raw) : Number.NaN
    return Number.isFinite(n) ? n : undefined
  }
  const out = path.resolve(values.out)
  const result = await snapshot(
    {
      name: path.basename(out, '.png'),
      url: values.url,
      waitForSelector: values['wait-selector'],
      waitForText: values['wait-text'],
      viewport: {
        width: num(values.width) ?? DEFAULT_VIEWPORT.width,
        height: num(values.height) ?? DEFAULT_VIEWPORT.height,
        deviceScaleFactor:
          num(values.scale) ?? DEFAULT_VIEWPORT.deviceScaleFactor,
      },
      settleMs: num(values.settle),
      diffThreshold: num(values['diff-threshold']),
    },
    {
      outDir: path.dirname(out),
      force: values.force,
      headed: values.headed,
      chromePath: values.chrome,
    },
  )
  console.log(`${result.status}: ${out}`)
}

// Run the CLI only when invoked directly, not when imported as a library.
if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
