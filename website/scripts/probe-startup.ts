// Throwaway: count and time the specific startup costs the CPU profile pointed
// at — WebGL program/shader compiles, GL contexts, workers, blob stop-tokens —
// by wrapping the platform APIs before any app code runs.
//
//   node scripts/probe-startup.ts [--headed] [--tracks=a,b] [--loc=...]
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

import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
const jbrowseWebRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')

const arg = (name: string, fallback: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback

const headed = process.argv.includes('--headed')
const deferStatus = process.argv.includes('--defer-shader-status')
const loc = arg('loc', 'ctgA:1-20,000')
const tracks = arg(
  'tracks',
  'volvox_alignments,gff3tabix_genes,volvox_microarray',
).split(',')
const PORT = 3343
const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 1 }

interface Probe {
  contexts: number
  programs: number
  shaders: number
  compileMs: number
  linkMs: number
  statusMs: number
  blobUrls: number
  blobRevokes: number
  syncXhr: number
  syncXhrMs: number
  workers: string[]
  programMs: number[]
  programsUsed: number
  programsDrawn: number
  hasSAB: boolean
  crossOriginIsolated: boolean
}

async function install(page: Page, deferStatus: boolean) {
  await page.evaluateOnNewDocument((defer: boolean) => {
    const p = {
      contexts: 0,
      programs: 0,
      shaders: 0,
      compileMs: 0,
      linkMs: 0,
      statusMs: 0,
      blobUrls: 0,
      blobRevokes: 0,
      syncXhr: 0,
      syncXhrMs: 0,
      workers: [] as string[],
      programMs: [] as number[],
      programsUsed: 0,
      programsDrawn: 0,
      hasSAB: typeof SharedArrayBuffer !== 'undefined',
      crossOriginIsolated: self.crossOriginIsolated,
    }
    ;(window as unknown as { __probe: typeof p }).__probe = p

    const time = <T>(fn: () => T, add: (ms: number) => void) => {
      const t0 = performance.now()
      const r = fn()
      add(performance.now() - t0)
      return r
    }

    const gc = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof gc>
    ) {
      if (String(args[0]).startsWith('webgl')) {
        p.contexts++
      }
      // eslint-disable-next-line prefer-spread
      return gc.apply(this, args)
    } as typeof gc

    const gl2 = WebGL2RenderingContext.prototype
    const origCompile = gl2.compileShader
    gl2.compileShader = function (this: WebGL2RenderingContext, s) {
      p.shaders++
      time(
        () => {
          origCompile.call(this, s)
        },
        ms => (p.compileMs += ms),
      )
    }
    const origLink = gl2.linkProgram
    gl2.linkProgram = function (this: WebGL2RenderingContext, prog) {
      p.programs++
      time(
        () => {
          origLink.call(this, prog)
        },
        ms => (p.linkMs += ms),
      )
    }
    // the blocking part: querying LINK/COMPILE status forces the driver to
    // finish the compile the call above only queued
    //
    // With `defer`, LINK_STATUS/COMPILE_STATUS answer `true` without asking the
    // driver — simulating a HAL that queues every compile and only checks the
    // result later (what KHR_parallel_shader_compile is for). The shaders are
    // known-good, so the optimistic answer is the same one the real query gives;
    // what changes is that startup no longer waits for the driver.
    const origProgParam = gl2.getProgramParameter
    gl2.getProgramParameter = function (this: WebGL2RenderingContext, prog, n) {
      if (defer && n === this.LINK_STATUS) {
        return true
      }
      return time(
        () => origProgParam.call(this, prog, n),
        ms => {
          p.statusMs += ms
          if (n === this.LINK_STATUS) {
            p.programMs.push(ms)
          }
        },
      )
    }
    const origShaderParam = gl2.getShaderParameter
    gl2.getShaderParameter = function (this: WebGL2RenderingContext, s, n) {
      if (defer && n === this.COMPILE_STATUS) {
        return true
      }
      return time(
        () => origShaderParam.call(this, s, n),
        ms => (p.statusMs += ms),
      )
    }

    // which of the compiled programs the page actually binds / draws with
    const used = new Set<unknown>()
    const drawn = new Set<unknown>()
    const origUse = gl2.useProgram
    let current: unknown = null
    gl2.useProgram = function (this: WebGL2RenderingContext, prog) {
      current = prog
      if (prog) {
        used.add(prog)
        p.programsUsed = used.size
      }
      origUse.call(this, prog)
    }
    const origDraw = gl2.drawArraysInstanced
    gl2.drawArraysInstanced = function (
      this: WebGL2RenderingContext,
      mode: number,
      first: number,
      count: number,
      inst: number,
    ) {
      if (current && inst > 0 && count > 0) {
        drawn.add(current)
        p.programsDrawn = drawn.size
      }
      origDraw.call(this, mode, first, count, inst)
    }

    const origCreateURL = URL.createObjectURL
    URL.createObjectURL = function (obj: Blob | MediaSource) {
      p.blobUrls++
      return origCreateURL.call(URL, obj)
    }
    const origRevoke = URL.revokeObjectURL
    URL.revokeObjectURL = function (url: string) {
      p.blobRevokes++
       origRevoke.call(URL, url)
    }

    const OrigWorker = Worker
    // eslint-disable-next-line no-global-assign
    ;(window as unknown as { Worker: typeof Worker }).Worker = function (
      this: Worker,
      url: string | URL,
      opts?: WorkerOptions,
    ) {
      p.workers.push(String(url))
      return new OrigWorker(url, opts)
    } as unknown as typeof Worker

    const origOpen = XMLHttpRequest.prototype.open
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { __sync?: boolean },
      method: string,
      url: string | URL,
      async?: boolean,
      user?: string | null,
      pw?: string | null,
    ) {
      this.__sync = async === false
       origOpen.call(this, method, url, async ?? true, user, pw)
    }
    const origSend = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { __sync?: boolean },
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      if (this.__sync) {
        p.syncXhr++
        const t0 = performance.now()
        try {
          origSend.call(this, body)
        } finally {
          p.syncXhrMs += performance.now() - t0
        }
      } else {
        origSend.call(this, body)
      }
    }
  }, deferStatus)
}

async function main() {
  const server = await createTestServer(PORT, { jbrowseWebRoot, repoRoot })
  const browser = await launch({
    headless: !headed,
    defaultViewport: VIEWPORT,
    executablePath: findChromeExecutable(),
    args: [...BASE_CHROME_ARGS, '--use-angle=gl'],
  })
  try {
    const page = await browser.newPage()
    await install(page, deferStatus)
    const url = `http://localhost:${PORT}/${lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc,
      tracks,
    })}`
    const t0 = Date.now()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('[data-testid="zoom_in"]', { timeout: 60000 })
    const toView = Date.now() - t0
    await waitForLoadingComplete(page, { timeout: 60000, waitForDownloads: true })
    await waitForDisplayPhases(page, 60000)
    await waitForDisplaysDone(page, 60000)
    await waitForQuiescent(page, { timeout: 60000 })
    await delay(500)
    const probe = (await page.evaluate(
      () => (window as unknown as { __probe: Probe }).__probe,
    ))
    // what each RPC worker actually downloads + evaluates
    for (const w of page.workers()) {
      const res = (await w.evaluate(() => {
        const entries = performance.getEntriesByType(
          'resource',
        ) as PerformanceResourceTiming[]
        return {
          count: entries.length,
          bytes: entries.reduce((a, b) => a + b.encodedBodySize, 0),
          top: entries
            .slice()
            .sort((a, b) => b.encodedBodySize - a.encodedBodySize)
            .map(e => e.name.split('/').pop() ?? ''),
        }
      }))
      process.stderr.write(
        `worker scripts: ${res.count} files, ${(res.bytes / 1024) | 0} KB — ${res.top.join(', ')}\n`,
      )
    }

    const gpu = await page.evaluate(() => {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2')
      const ext = gl?.getExtension('WEBGL_debug_renderer_info')
      const par = gl?.getExtension('KHR_parallel_shader_compile')
      return {
        renderer:
          ext && gl
            ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
            : 'unknown',
        parallelShaderCompile: Boolean(par),
      }
    })
    process.stderr.write(
      [
        `defer-shader-status: ${deferStatus}`,
        `nav -> view visible ${toView} ms, nav -> settled ${Date.now() - t0} ms`,
        `GPU: ${gpu.renderer}`,
        `KHR_parallel_shader_compile available: ${gpu.parallelShaderCompile}`,
        `crossOriginIsolated: ${probe.crossOriginIsolated} (SharedArrayBuffer: ${probe.hasSAB})`,
        `webgl contexts created: ${probe.contexts}`,
        `programs linked: ${probe.programs}, shaders compiled: ${probe.shaders}`,
        `time in compileShader ${probe.compileMs.toFixed(0)} ms, linkProgram ${probe.linkMs.toFixed(0)} ms, status queries ${probe.statusMs.toFixed(0)} ms`,
        `programs actually bound: ${probe.programsUsed}, programs actually drawn with: ${probe.programsDrawn}`,
        `per-program link-status ms (sorted): ${[...probe.programMs].sort((a, b) => b - a).map(x => x.toFixed(0)).join(' ')}`,
        `blob URLs created: ${probe.blobUrls}, revoked: ${probe.blobRevokes}`,
        `synchronous XHRs on main thread: ${probe.syncXhr} (${probe.syncXhrMs.toFixed(0)} ms)`,
        `workers: ${probe.workers.length}`,
        ...probe.workers.map(w => `  ${w.slice(0, 120)}`),
      ].join('\n') + '\n',
    )
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
