import { analyzeCanvasPng, assertNonBlank } from '../canvasContent.ts'
import {
  delay,
  findByTestId,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { comparePngBuffers } from '../pngDiff.ts'
import { snapshotConfig } from '../snapshot.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// Tests for behavior that jsdom (the jest unit suite) structurally cannot
// exercise: real GPU shader output, devicePixelRatio scaling on a real canvas,
// WebGL context-loss/restore against a live driver, and the web-worker RPC
// boundary (jest runs RPC on the main thread). These are the failure modes that
// would "cause alarm regarding shaders" yet pass every jsdom test.

const PILEUP_DONE = '[data-testid="pileup-display-done"]'

function alignmentsSpec(loc: string, track: string) {
  return {
    views: [
      { type: 'LinearGenomeView', assembly: 'volvox', loc, tracks: [track] },
    ],
  }
}

// Open an alignments pileup and wait for first paint (the canvasDrawn `*-done`
// testid). `volvox_alignments` is only in the default (worker) config;
// `volvox_sv` exists in both the worker and main-thread configs, so the
// worker-vs-main-thread test uses it.
async function loadAlignments(
  page: Page,
  {
    loc = 'ctgA:1000-2000',
    track = 'volvox_alignments',
    config,
  }: { loc?: string; track?: string; config?: string } = {},
) {
  await navigateWithSessionSpec(page, alignmentsSpec(loc, track), config)
  await findByTestId(page, 'pileup-display-done', 60000)
  await waitForDataLoaded(page)
  await delay(500)
}

// Grab the rendered pixels of the pileup canvas as a PNG buffer.
async function canvasPng(page: Page, selector = `${PILEUP_DONE} canvas`) {
  const el = await page.waitForSelector(selector, { timeout: 60000 })
  if (!el) {
    throw new Error(`canvas not found: ${selector}`)
  }
  return el.screenshot({ type: 'png' })
}

const suite: TestSuite = {
  name: 'GPU Browser Quirks',
  tests: [
    {
      // The `canvas_width`/`canvas_height` uniforms are CSS pixels and the
      // backing store is dpr-scaled in syncCanvasSize/prepareCanvas. A
      // regression that scales the wrong way (or forgets dpr) renders correctly
      // at dpr=1 — which is all jsdom and a default headless viewport ever see —
      // but draws into a quarter of the canvas (or blurs) at dpr=2. Render the
      // identical view at dpr=1 and dpr=2 and require the backing store to grow
      // ~2x while the visible content stays full-coverage.
      name: 'renders correctly at devicePixelRatio=2 (hi-DPI)',
      fn: async page => {
        await page.setViewport({
          width: 1280,
          height: 800,
          deviceScaleFactor: 1,
        })
        await loadAlignments(page)
        const dims1 = await page.evaluate((sel: string) => {
          const c = document.querySelector<HTMLCanvasElement>(`${sel} canvas`)
          return c
            ? { backing: c.width, css: c.getBoundingClientRect().width }
            : null
        }, PILEUP_DONE)
        if (!dims1) {
          throw new Error('dpr=1 canvas not found')
        }
        assertNonBlank(analyzeCanvasPng(await canvasPng(page)), 'dpr=1 pileup')

        await page.setViewport({
          width: 1280,
          height: 800,
          deviceScaleFactor: 2,
        })
        await loadAlignments(page)
        const dims2 = await page.evaluate((sel: string) => {
          const c = document.querySelector<HTMLCanvasElement>(`${sel} canvas`)
          return c
            ? { backing: c.width, css: c.getBoundingClientRect().width }
            : null
        }, PILEUP_DONE)
        if (!dims2) {
          throw new Error('dpr=2 canvas not found')
        }
        const stats2 = analyzeCanvasPng(await canvasPng(page))
        assertNonBlank(stats2, 'dpr=2 pileup')

        // backing store must track dpr: ~2x the dpr=1 backing for a same-size
        // CSS box. Allow slack for layout rounding.
        const ratio = dims2.backing / dims1.backing
        if (ratio < 1.7 || ratio > 2.3) {
          throw new Error(
            `dpr=2 backing store not ~2x dpr=1 (got ${dims2.backing} vs ${dims1.backing}, ratio ${ratio.toFixed(2)}). ` +
              `Indicates devicePixelRatio is not applied to the canvas backing store.`,
          )
        }
        // Content must still fill the canvas, not collapse into one quadrant —
        // the classic "drew in CSS px into a dpr-scaled buffer" bug.
        if (stats2.nonBgFraction < 0.01) {
          throw new Error(
            `dpr=2 pileup content too sparse (${(stats2.nonBgFraction * 100).toFixed(2)}%) — ` +
              `reads likely drawn into a fraction of the dpr-scaled canvas`,
          )
        }
      },
    },
    {
      // WebGL context loss is a real-browser-only event (GPU reset, tab
      // backgrounding, driver hiccup). useRenderer re-inits the backend on
      // `webglcontextrestored`; the HAL re-creates all buffers. jsdom's unit
      // test only dispatches a synthetic event — it can't prove the live driver
      // actually repaints. Force a real loss+restore and require the canvas to
      // come back non-blank. WebGL-only (canvas2d has no GL context; webgpu uses
      // device-lost, a different path).
      name: 'recovers from WebGL context loss',
      fn: async page => {
        const backend = snapshotConfig.backend
        const isWebgl = backend === 'webgl' || backend === ''
        if (isWebgl) {
          await loadAlignments(page)
          assertNonBlank(analyzeCanvasPng(await canvasPng(page)), 'pre-loss')

          const glErrors: string[] = []
          const onConsole = (msg: { type(): string; text(): string }) => {
            if (msg.text().includes('INVALID_OPERATION')) {
              glErrors.push(msg.text())
            }
          }
          page.on('console', onConsole)

          const lost = await page.evaluate((sel: string) => {
            const c = document.querySelector<HTMLCanvasElement>(`${sel} canvas`)
            const gl = c?.getContext('webgl2')
            const ext = gl?.getExtension('WEBGL_lose_context')
            if (!ext) {
              return false
            }
            ext.loseContext()
            // restore on the next tick; the browser fires
            // webglcontextlost synchronously, restore must be deferred
            setTimeout(() => {
              ext.restoreContext()
            }, 100)
            return true
          }, PILEUP_DONE)

          if (lost) {
            // give useRenderer time to observe restore, re-init the backend,
            // and the upload+render autorun to repaint
            await delay(3000)
            await waitForDataLoaded(page, 60000)
            page.off('console', onConsole)
            assertNonBlank(
              analyzeCanvasPng(await canvasPng(page)),
              'post-restore (context-loss recovery failed to repaint)',
            )
            if (glErrors.length > 0) {
              throw new Error(
                `GL INVALID_OPERATION errors during context-loss recovery (dispose guard missing?):\n${glErrors.join(
                  '\n',
                )}`,
              )
            }
          } else {
            page.off('console', onConsole)
            // eslint-disable-next-line no-console
            console.log(
              '      [skip] WEBGL_lose_context unavailable on this canvas',
            )
          }
        } else {
          // eslint-disable-next-line no-console
          console.log(
            `      [skip] context-loss test is WebGL-only (backend=${backend})`,
          )
        }
      },
    },
    {
      // The worker boundary transfers absolute-uint32 typed arrays back to the
      // main thread (transferables / structured clone). A serialization bug —
      // wrong subarray offset, detached buffer, coordinate truncation — would
      // corrupt only the worker path, which jest never runs (it uses
      // main-thread RPC). Render the same BAM region via the worker (default
      // config) and via main-thread RPC and require the two canvases to agree.
      name: 'worker RPC render matches main-thread RPC render',
      fn: async page => {
        const loc = 'ctgA:2,707..48,600'
        await loadAlignments(page, { loc, track: 'volvox_sv' })
        const workerPng = await canvasPng(page)

        await loadAlignments(page, {
          loc,
          track: 'volvox_sv',
          config: 'test_data/volvox/config_main_thread.json',
        })
        const mainPng = await canvasPng(page)

        assertNonBlank(analyzeCanvasPng(workerPng), 'worker-rpc pileup')
        assertNonBlank(analyzeCanvasPng(mainPng), 'main-thread-rpc pileup')

        const diff = comparePngBuffers(workerPng, mainPng)
        if (!diff.sameSize) {
          throw new Error(
            `worker (${diff.widthA}x${diff.heightA}) and main-thread ` +
              `(${diff.widthB}x${diff.heightB}) canvas sizes differ`,
          )
        }
        // small drift is acceptable (read order / AA); large drift means the
        // worker boundary corrupted the rendered data
        const diffPercent = diff.diffFraction * 100
        if (diffPercent > 5) {
          throw new Error(
            `worker vs main-thread pileup differ by ${diffPercent.toFixed(2)}% — ` +
              `suggests data corruption across the worker boundary`,
          )
        }
      },
    },
  ],
}

export default suite
