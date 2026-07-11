import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BASE_CHROME_ARGS,
  createTestServer,
  findChromeExecutable,
  waitForLoadingComplete,
  waitForQuiescent,
} from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import { delay, textSelector, waitForVisible } from './actions.ts'
import { lgvSession, VOLVOX } from './screenshot-spec-helpers.ts'

import type { Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const outDir = path.resolve(__dirname, '..', 'static', 'video')

const PORT = 3335
// 16:9 at a size that keeps the webm small but legible; deviceScaleFactor 1
// (video doesn't need the 2x retina backing store the stills use).
const VIEWPORT = { width: 1280, height: 720, deviceScaleFactor: 1 }

// Click a header zoom control and let its animated zoom play out on camera. The
// button fires model.zoom() (animated), unlike zoomTo(); the delay is what the
// screencast actually records as smooth motion.
async function animatedZoom(page: Page, dir: 'in' | 'out', times: number) {
  for (let i = 0; i < times; i++) {
    const btn = await page.$(`[data-testid="zoom_${dir}"]`)
    await btn?.click()
    await delay(700)
  }
}

// Drag horizontally across the track area to pan the view — smooth scroll motion
// the stills can't show. Stepped so the screencast captures intermediate frames.
async function panDrag(page: Page, fromX: number, toX: number, y: number) {
  await page.mouse.move(fromX, y)
  await page.mouse.down()
  await page.mouse.move(toX, y, { steps: 40 })
  await page.mouse.up()
  await delay(500)
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const server = await createTestServer(PORT, {
    jbrowseWebRoot: testDataRoot,
    repoRoot,
  })
  const browser = await launch({
    headless: true,
    defaultViewport: VIEWPORT,
    executablePath: findChromeExecutable(),
    args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
  })
  const webmPath = path.join(outDir, 'volvox_tour.webm')
  try {
    const page = await browser.newPage()
    // Surface a tab crash / uncaught page error instead of only seeing its
    // downstream "Target closed" when the next command runs.
    page.on('error', err => {
      console.error(`PAGE CRASH: ${err.message}`)
    })
    page.on('pageerror', err => {
      console.error(`PAGE ERROR: ${err.message}`)
    })
    const url = lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50,000',
      tracks: ['volvox_microarray', 'volvox_cram_alignments'],
    })
    await page.goto(`http://localhost:${PORT}/${url}`, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    })
    await waitForVisible(page, textSelector('ctgA'))
    await waitForLoadingComplete(page, { waitForDownloads: true })
    await waitForQuiescent(page)
    await delay(1000)

    const recorder = await page.screencast({ path: webmPath, fps: 30 })
    // Finalize the webm no matter how the motion ends — an unfinalized file has
    // no duration header and every downstream ffmpeg transcode fails on it.
    try {
      await delay(800)
      await animatedZoom(page, 'in', 4)
      await delay(500)
      await panDrag(page, 1000, 300, 500)
      await panDrag(page, 1000, 300, 500)
      await delay(500)
      await animatedZoom(page, 'in', 3)
      await delay(800)
      await animatedZoom(page, 'out', 3)
      await delay(800)
    } finally {
      await recorder.stop().catch((err: unknown) => {
        console.error(
          `recorder.stop failed: ${err instanceof Error ? err.message : err}`,
        )
      })
    }
    console.log(`wrote ${webmPath}`)
  } finally {
    await browser.close()
    server.close()
  }

  // Transcode to broadly-embeddable mp4 (h264/yuv420p) and a preview gif.
  const mp4Path = path.join(outDir, 'volvox_tour.mp4')
  execFileSync('ffmpeg', [
    '-y', '-i', webmPath,
    '-vf', 'scale=1280:-2:flags=lanczos',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23',
    '-movflags', '+faststart',
    mp4Path,
  ])
  const gifPath = path.join(outDir, 'volvox_tour.gif')
  execFileSync('ffmpeg', [
    '-y', '-i', webmPath,
    '-vf', 'fps=12,scale=720:-1:flags=lanczos',
    gifPath,
  ])
  console.log(`wrote ${mp4Path}\nwrote ${gifPath}`)
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
