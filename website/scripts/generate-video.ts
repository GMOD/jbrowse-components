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
import { VOLVOX, lgvSession } from './screenshot-spec-helpers.ts'

import type { Page } from 'puppeteer'

function log(msg: string) {
  process.stderr.write(
    `[video ${new Date().toISOString().slice(11, 23)}] ${msg}\n`,
  )
}
process.on('unhandledRejection', (reason: unknown) => {
  log(`UNHANDLED REJECTION: ${reason instanceof Error ? reason.stack : reason}`)
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')
const testDataRoot = path.resolve(repoRoot, 'products', 'jbrowse-web')
const outDir = path.resolve(__dirname, '..', 'static', 'video')

const headed = process.argv.includes('--headed')

const PORT = 3335
// Widescreen ~21:9 and short — the LGV is a horizontal strip (header + a couple
// tracks), so a wide, shallow frame fills with genome instead of dead space
// below the tracks. deviceScaleFactor 1 (video doesn't need the stills' 2x).
const VIEWPORT = { width: 1600, height: 620, deviceScaleFactor: 1 }
// Time a cursor glide takes on camera; also how long we let each animated zoom
// spring play before the next click.
const GLIDE_MS = 550
const SETTLE_MS = 650

// Inject a fake pointer + click-ripple overlay. Headless Chrome renders no OS
// cursor into the screencast, so the motion would otherwise look untethered —
// this draws an arrow that we keep in sync with page.mouse and pulse on click.
async function injectCursor(page: Page) {
  await page.evaluate(glideMs => {
    const cursor = document.createElement('div')
    cursor.id = '__tour_cursor'
    cursor.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24">
      <path d="M5 3l14 7-6 1.5L9.5 19 5 3z" fill="#fff"
        stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>`
    Object.assign(cursor.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
      transform: 'translate(-100px, -100px)',
      transition: `transform ${glideMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))',
    })
    document.body.append(cursor)
  }, GLIDE_MS)
}

// Glide the fake cursor to (x, y) and move the real mouse there in lockstep, then
// wait out the CSS glide so the screencast records the travel.
async function moveCursor(page: Page, x: number, y: number) {
  await page.evaluate(
    (cx, cy) => {
      const c = document.getElementById('__tour_cursor')
      if (c) {
        c.style.transform = `translate(${cx}px, ${cy}px)`
      }
    },
    x,
    y,
  )
  await page.mouse.move(x, y)
  await delay(GLIDE_MS + 80)
}

// Expanding-ring pulse at (x, y) to make each click legible on camera.
async function clickPulse(page: Page, x: number, y: number) {
  await page.evaluate(
    (cx, cy) => {
      const ring = document.createElement('div')
      Object.assign(ring.style, {
        position: 'fixed',
        left: `${cx}px`,
        top: `${cy}px`,
        width: '14px',
        height: '14px',
        marginLeft: '-7px',
        marginTop: '-7px',
        borderRadius: '50%',
        border: '2px solid #1e88e5',
        pointerEvents: 'none',
        zIndex: '2147483646',
      })
      document.body.append(ring)
      ring
        .animate(
          [
            { transform: 'scale(0.4)', opacity: 0.9 },
            { transform: 'scale(3.2)', opacity: 0 },
          ],
          { duration: 450, easing: 'ease-out' },
        )
        .addEventListener('finish', () => {
          ring.remove()
        })
    },
    x,
    y,
  )
}

// Move the visible cursor onto a header button, pulse, then perform the real
// click. With a light render the main thread is free, so the click's
// clickable-point evaluate resolves immediately (a heavy pileup render would
// stall it for seconds — the original CRAM tour's failure mode).
async function clickButton(page: Page, testid: string, label: string) {
  const btn = await page.$(`[data-testid="${testid}"]`)
  const box = await btn?.boundingBox()
  if (btn && box) {
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await moveCursor(page, x, y)
    await clickPulse(page, x, y)
    await btn.click()
  } else {
    log(`clickButton: ${label} (${testid}) not found`)
  }
}

async function zoomTour(page: Page, dir: 'in' | 'out', times: number) {
  for (let i = 0; i < times; i++) {
    await clickButton(page, `zoom_${dir}`, `zoom ${dir}`)
    await delay(SETTLE_MS)
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const server = await createTestServer(PORT, {
    jbrowseWebRoot: testDataRoot,
    repoRoot,
  })
  const browser = await launch({
    headless: !headed,
    defaultViewport: VIEWPORT,
    executablePath: findChromeExecutable(),
    args: [...BASE_CHROME_ARGS, '--enable-unsafe-swiftshader'],
  })
  // Typed as a `.webm` template literal so it satisfies screencast's branded
  // path type without a cast.
  const webmPath: `${string}.webm` = `${outDir}/volvox_tour.webm`
  try {
    const page = await browser.newPage()
    // Surface a tab crash / uncaught page error instead of only seeing its
    // downstream "Target closed" when the next command runs.
    page.on('error', err => {
      log('PAGE CRASH:')
      console.error(err)
    })
    page.on('pageerror', err => {
      log('PAGE ERROR:')
      console.error(err)
    })
    // Light tracks (wiggle + genes) keep the main thread free so button clicks
    // never stall and the zoom springs stay smooth on camera. A per-read CRAM
    // pileup under swiftshader blocks the thread for seconds per zoom frame.
    const url = lgvSession(VOLVOX, {
      assembly: 'volvox',
      loc: 'ctgA:1-50,000',
      tracks: ['volvox_microarray', 'gff3tabix_genes'],
    })
    await page.goto(`http://localhost:${PORT}/${url}`, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    })
    log('page loaded, waiting for quiescence')
    await waitForVisible(page, textSelector('ctgA'))
    await waitForLoadingComplete(page, { waitForDownloads: true })
    await waitForQuiescent(page)
    await injectCursor(page)
    await moveCursor(page, VIEWPORT.width / 2, VIEWPORT.height / 2)
    await delay(800)

    log('starting screencast')
    const recorder = await page.screencast({ path: webmPath, fps: 30 })
    // Always stop the recorder, however the motion ends — stop() flushes the
    // remaining frames and closes ffmpeg's stdin so the webm isn't left
    // truncated ("File ended prematurely" on later reads).
    try {
      await delay(600)
      log('zoom in')
      await zoomTour(page, 'in', 6)
      await delay(700)
      log('zoom out')
      await zoomTour(page, 'out', 6)
      await delay(700)
      log('motion complete')
    } catch (err: unknown) {
      log('motion threw:')
      console.error(err)
    } finally {
      log('calling recorder.stop()')
      const stopped = await Promise.race([
        recorder
          .stop()
          .then(() => 'ok')
          .catch(
            (err: unknown) =>
              `stop rejected: ${err instanceof Error ? err.message : err}`,
          ),
        delay(15000).then(() => 'TIMEOUT after 15s'),
      ])
      log(`recorder.stop() → ${stopped}`)
    }
    log(`wrote ${webmPath}`)
  } finally {
    await browser.close()
    server.close()
  }

  // Transcode to broadly-embeddable mp4 (h264/yuv420p) and a preview gif. The
  // screencast's piped VP9/webm has no container-level duration header
  // (duration=N/A is normal), so the mp4 — which does carry a real duration — is
  // what we verify to confirm the capture wasn't truncated.
  const mp4Path = path.join(outDir, 'volvox_tour.mp4')
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    webmPath,
    '-vf',
    'scale=1280:-2:flags=lanczos',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '23',
    '-movflags',
    '+faststart',
    mp4Path,
  ])
  const duration = probeDuration(mp4Path)
  if (!duration) {
    throw new Error(`mp4 has no duration (${duration}s) — capture truncated`)
  }
  const gifPath = path.join(outDir, 'volvox_tour.gif')
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    webmPath,
    '-vf',
    'fps=12,scale=720:-1:flags=lanczos',
    gifPath,
  ])
  log(`wrote ${mp4Path} (${duration.toFixed(1)}s)`)
  log(`wrote ${gifPath}`)
}

function probeDuration(file: string) {
  const out = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    file,
  ])
    .toString()
    .trim()
  const duration = Number.parseFloat(out)
  return Number.isFinite(duration) ? duration : undefined
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
