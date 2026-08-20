/* eslint-disable no-console */
// One-off probe (not a suite): take a real synteny band's WebGPU swap chain away
// from under it, the way a superseded HAL's dispose() used to, and see whether
// the display comes back.
//
// `getContext('webgpu')` hands back the same GPUCanvasContext every time, so
// calling unconfigure() on it from here is exactly what the losing HAL did to
// the live one — no app state is faked. Before the guard in webgpuHal, the next
// frame threw `InvalidStateError: GPUCanvasContext.getCurrentTexture: Canvas not
// configured`, the render autorun turned it into `renderError`, and the band
// banners it until the tab is reloaded (Firefox fires no context-lost event, so
// none of useRenderingBackend's recovery runs).
//
// Firefox Nightly only — Chrome + puppeteer does not render WebGPU canvases.
//
//   node products/jbrowse-web/browser-tests/swapchain-steal-probe.ts [outdir]
import fs from 'node:fs'
import path from 'node:path'

import { launch } from 'puppeteer'

import {
  navigateWithSessionSpec,
  setPort,
  waitForDataLoaded,
} from './helpers.ts'
import { startServerOnFreePort } from './server.ts'
import { snapshotConfig } from './snapshot.ts'

import type { Page } from 'puppeteer'

const outDir = process.argv[2] ?? '/tmp/swapchain-steal-probe'
snapshotConfig.backend = 'webgpu'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)
fs.mkdirSync(outDir, { recursive: true })

const browser = await launch({
  browser: 'firefox',
  executablePath: '/usr/bin/firefox-nightly',
  headless: false,
  timeout: 60000,
  extraPrefsFirefox: {
    'dom.webgpu.enabled': true,
    'gfx.webrender.all': true,
    'gfx.webgpu.ignore-blocklist': true,
  },
  defaultViewport: { width: 1280, height: 900 },
})

const CANVAS = '[data-testid="synteny_canvas"]'

// Inked pixel count AND a hash of them. The count alone cannot tell a repaint
// from a canvas still showing the frame it painted before the steal; the hash
// can, because every reading here is taken across a pan.
const readCanvas = async (page: Page) =>
  page.evaluate(sel => {
    const canvas = document.querySelector(sel) as HTMLCanvasElement
    const probe = document.createElement('canvas')
    probe.width = canvas.width
    probe.height = canvas.height
    const ctx = probe.getContext('2d')!
    ctx.drawImage(canvas, 0, 0)
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height)
    let inked = 0
    let hash = 2166136261
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 0) {
        inked++
      }
      hash = ((hash ^ data[i]! ^ data[i + 1]!) * 16777619) >>> 0
    }
    return { inked, hash: hash.toString(16) }
  }, CANVAS)

const banner = async (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('*')]
        .map(e => e.textContent)
        .find(t => t.includes('Canvas not configured')) ?? null,
  )

try {
  const page = await browser.newPage()
  page.on('console', m => {
    const t = m.text()
    if (t.includes('swap chain') || t.includes('not configured')) {
      console.log(`  page: ${t}`)
    }
  })
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['peach_grape_minimap2'],
          minAlignmentLength: 2000,
          drawCurves: true,
          colorBy: 'query',
          levelHeights: [350],
          views: [{ assembly: 'grape' }, { assembly: 'peach' }],
        },
      ],
    },
    'test_data/grape_peach_synteny/config.json',
  )
  await waitForDataLoaded(page, 120000)
  await page.waitForSelector(`${CANVAS}[data-display-drawn="true"]`, {
    timeout: 120000,
  })

  const before = await readCanvas(page)
  console.log(`drawn: ${before.inked} inked pixels, hash ${before.hash}`)
  await page.screenshot({ path: path.join(outDir, '1-before.png') })

  // The steal itself.
  await page.evaluate(sel => {
    const canvas = document.querySelector(sel) as HTMLCanvasElement
    const ctx = canvas.getContext('webgpu')!
    ;(ctx as unknown as { unconfigure: () => void }).unconfigure()
  }, CANVAS)
  console.log('swap chain stolen')
  const stolen = await readCanvas(page)
  console.log(
    `right after the steal: ${stolen.inked} inked, hash ${stolen.hash}`,
  )

  // Something the band must repaint for: a pan on both rows.
  await page.evaluate(() => {
    for (const v of (window as any).JBrowseSession.views[0].views) {
      v.horizontalScroll(120)
    }
  })
  await new Promise(r => setTimeout(r, 2000))

  const after = await readCanvas(page)
  const message = await banner(page)
  await page.screenshot({ path: path.join(outDir, '2-after.png') })
  console.log(`after a pan: ${after.inked} inked, hash ${after.hash}`)
  console.log(`banner: ${message ? `"${message.slice(0, 90)}"` : 'none'}`)
  const repainted = after.inked > 0 && after.hash !== before.hash
  console.log(
    repainted && !message
      ? 'RECOVERED — the band rebuilt its swap chain and drew a new frame'
      : 'BROKEN — no new frame reached the band',
  )
} finally {
  await browser.close()
  server.close()
}
