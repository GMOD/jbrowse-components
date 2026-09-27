// Films the tours in video-specs.ts against the local jbrowse-web build.
//
//   node scripts/generate-video.ts                    every spec, headless
//   node scripts/generate-video.ts --filter layout    the ones whose name matches
//   node scripts/generate-video.ts --headed           on the real GPU
//   node scripts/generate-video.ts --list             what there is to film
//
// `node`, NOT `npx tsx` — the same reason generate-screenshots.ts says so: tsx's
// keepNames breaks the functions this hands to page.evaluate.
//
// WHAT IT PRODUCES, per spec, under website/static/media:
//   <name>.mp4   h264, what the docs <Video> plays
//   <name>.jpg   the poster frame, so the embed is a picture before it is a play
//                button
//   <name>.vtt   the `say` lines, timed onto the clip (video-captions.ts), so
//                the route a tour takes is text as well as motion
//
// No webm, and it was measured rather than assumed: VP9 is usually the smaller
// codec for screen content, and at matched quality on these tours it came out
// LARGER than h264 both times (392 KB against 272 KB, 278 against 250). h264 in
// mp4 plays in every browser that plays anything, so a second encode was a
// bigger file, a longer run and another blob in the store for nothing.
//
// The bytes are gitignored and live in the media store (scripts/media-store.ts),
// the same arrangement the figures use and for the same reason: a screencast is
// an undeltifiable blob that git would keep forever.
//
// WHAT THE RUN SAYS AT THE END is video-report.ts: the frame each tour was
// filmed in against the height the app actually reached, the displays that had
// not painted by the last frame, and the steps the camera sat through while
// nothing moved. Nothing diffs a clip, so a run is the only place any of that is
// visible.
//
// TWO THINGS THIS DOES THAT A SCREENSHOT RUN DOES NOT, both because a film is
// watched rather than glanced at:
//
//   IT DRAWS A CURSOR (scripts/video-overlay.ts). Headless Chrome renders no OS
//   pointer into a screencast, so without one the menus open themselves.
//
//   IT TAKES THE CAMERA OFF FOR THE LONG WAITS (`cut` on a step). A subgraph cut
//   is seconds of spinner, and a film of a spinner is not a film of anything.
//   The clip is stitched back together at encode time, so the pacing is a
//   property of the spec rather than of the machine it was filmed on.
//
// KEEP THE TOURS ON LIGHT TRACKS. A per-read pileup under headless swiftshader
// blocks the main thread for seconds per animated frame, which starves the
// click's own round trip until it throws "Target closed" — measured, and the
// reason the first prototype could not finish a capture. It is a software
// rasterization artifact rather than a rendering bug (the same tour is smooth on
// a real GPU), so heavy content can still be filmed with --headed.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import { delay } from '@jbrowse/browser-test-utils'

import { actionTargetPoint, dragPoints, runAction } from './actions.ts'
import { withHarness } from './dev-harness.ts'
import { matchesFilterTokens, parseFilterTokens } from './filter-tokens.ts'
import { debugDump } from './screenshot-asserts.ts'
import {
  describeNetwork,
  trackNetwork,
  trustCapturePlugins,
} from './screenshot-page.ts'
import { pinRenderer, waitForReady } from './screenshot-ready.ts'
import { captionTrack, writeVtt } from './video-captions.ts'
import {
  injectOverlay,
  clickPulse,
  dragCursor,
  keyPress,
  moveCursor,
  parkCursor,
  scrollPage,
  clearCaptionForTail,
  setCaption,
} from './video-overlay.ts'
import {
  printVideoSummary,
  recordFilmed,
  unpaintedDisplays,
} from './video-report.ts'
import {
  VIDEO_OUTPUT_WIDTH,
  validateVideoSpecs,
  videoFrame,
} from './video-spec-rules.ts'
import { externalClips, pastedTrackConfigs, videoSpecs } from './video-specs.ts'

import type { Cue } from './video-captions.ts'
import type { VideoSpec, VideoStep } from './video-specs.ts'
import type { Page } from 'puppeteer'

const { values } = (() => {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      options: {
        help: { type: 'boolean', short: 'h', default: false },
        filter: { type: 'string', multiple: true },
        headed: { type: 'boolean', default: false },
        list: { type: 'boolean', default: false },
        // keep the per-segment webm captures next to the output, for working out
        // why a stitched clip looks wrong
        'keep-segments': { type: 'boolean', default: false },
        // the capture server's port, for a machine already running one
        port: { type: 'string' },
        // film against the jbrowse-web build already on disk, for a batch
        // re-filmed in several runs off one commit
        'no-build': { type: 'boolean', default: false },
      },
    })
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
})()

function log(msg: string) {
  process.stderr.write(
    `[video ${new Date().toISOString().slice(11, 23)}] ${msg}\n`,
  )
}

function buildJbrowseWeb() {
  log('Building jbrowse-web')
  try {
    execFileSync('pnpm', ['--filter', '@jbrowse/web', 'build'], {
      stdio: 'inherit',
    })
  } catch {
    log('ERROR: pnpm build failed — could not build jbrowse-web')
    process.exit(1)
  }
}

process.on('unhandledRejection', (reason: unknown) => {
  log(`UNHANDLED REJECTION: ${reason instanceof Error ? reason.stack : reason}`)
})

const outDir = path.resolve(import.meta.dirname, '..', 'static', 'media')

// Away from the screenshots' 3334 and a dev server on 3000, so a film can be
// taken while either is running. Overridable because this repo is worked in by
// several agents at once and a taken port is a run that dies before it loads
// anything.
const PORT = Number(values.port ?? process.env.VIDEO_PORT ?? 3335)
const FPS = 30
// ONE, and it is not a choice. `page.screencast` sets deviceScaleFactor to 0 for
// the duration of the recording (it wants "native pixel dimensions"), so frames
// come back at the viewport's CSS size whatever the page was laid out at — and
// asking for 2 only buys a viewport change at the moment the camera starts. The
// frame is the delivery resolution, so a tour is framed for legibility by
// choosing a viewport, not by supersampling one.
const DEVICE_SCALE = 1
// A ceiling rather than a target: the encode never upscales, so this only bites
// on a spec filmed wider than a docs column can use — which validateVideoSpecs
// refuses, so that the finished clip's size is always the viewport the spec
// asked for and remark-video can reserve the embed's box from it.
const OUTPUT_WIDTH = VIDEO_OUTPUT_WIDTH
// What a step holds for once it has finished, unless it says otherwise. Long
// enough to see a menu open, short enough that a six-step tour is not a minute.
const HOLD_MS = 900
// Filmed after the click that starts a `cut` step's work, before the camera goes
// off. Without it the click and its result are the same frame, and a reader sees
// a menu item teleport into a graph.
const PRE_CUT_MS = 1200
const TAIL_MS = 2500
// How long a caption stays up before the next one may replace it: a beat to
// notice it, then a word at a time. A line comes down only once it has been on
// camera this long, so a phase whose clicks run quickly cannot wipe its own
// explanation before it has been read.
const READING_BASE_MS = 1000
const READING_MS_PER_WORD = 320
// A typed value is filmed at a typist's pace, so a gene name reads as a name
// being entered. Past PASTE_OVER_CHARS it is a URL or a config, which a reader
// pastes, and the film pastes it too.
const TYPING_MS_PER_CHAR = 110
const PASTE_OVER_CHARS = 32

// Past this, a step the camera stayed on is a stretch of spinner in the finished
// clip. Reported rather than cut automatically: which waits are worth watching
// is the spec's call, and a slow render the tour is ABOUT would be the one thing
// an automatic cut removed.
const SLOW_STEP_MS = 6000

function readingMs(line: string) {
  const words = line.split(/\s+/).filter(Boolean).length
  return words ? READING_BASE_MS + READING_MS_PER_WORD * words : 0
}

const pasted = (step: VideoStep) =>
  step.type === 'type' && (step.value ?? '').length > PASTE_OVER_CHARS

// A `type` step as it is filmed. Off camera — a `cut` step, or the boot of a
// tour that follows a tab — the keystrokes are wall clock nobody watches, so
// only the on-camera ones are paced.
function filmedAction(step: VideoStep) {
  if (step.type !== 'type' || step.cut || step.typeDelayMs !== undefined) {
    return step
  }
  return pasted(step)
    ? { ...step, paste: true }
    : { ...step, typeDelayMs: TYPING_MS_PER_CHAR }
}

const holdMs = (step: VideoStep) =>
  step.hold ?? (UNHELD.has(step.type) ? 0 : HOLD_MS)

// What a viewer should never have to puzzle over, each of which a tour reaches
// by zooming past a display's density gate, launching a track the session
// lacks, or loading a file that fails. The run still reports success in every
// case, because the app is doing what it should with what it was given.
const CONFUSING_ON_CAMERA: [string, string][] = [
  ['[data-display-phase="tooLarge"]', 'a "Too many features" banner'],
  ['[data-testid="snackbar-error"]', 'an error toast'],
  ['[data-testid="snackbar-warning"]', 'a warning toast'],
  ['[data-testid="reload_button"]', 'a track error'],
]

// Named with the words on screen, since "a track error" alone sends the author
// looking for which track. Shown means what waitHiddenByNodePolling in
// actions.ts means by not hidden: styled visible, and not clipped away by an
// `overflow: hidden` ancestor, which a view does to every block past its edge.
async function confusingOnCamera(page: Page) {
  return page.evaluate((checks: [string, string][]) => {
    const shown = (node: Element) => {
      // ReplacedDisplay publishes `tooLarge` on a `display: contents` wrapper,
      // which has no box, and portals the banner over the track, so the
      // track's box is what is on camera
      let el: Element | null = node
      while (el && getComputedStyle(el).display === 'contents') {
        el = el.parentElement
      }
      if (!el) {
        return false
      }
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        Number(style.opacity) === 0 ||
        rect.width === 0 ||
        rect.height === 0 ||
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth
      ) {
        return false
      }
      for (let up = el.parentElement; up; up = up.parentElement) {
        const upStyle = getComputedStyle(up)
        if (Number(upStyle.opacity) === 0) {
          return false
        }
        if (
          [upStyle.overflowX, upStyle.overflowY].some(
            v => v === 'hidden' || v === 'clip',
          )
        ) {
          const box = up.getBoundingClientRect()
          if (
            rect.right <= box.left ||
            rect.left >= box.right ||
            rect.bottom <= box.top ||
            rect.top >= box.bottom
          ) {
            return false
          }
        }
      }
      return true
    }
    return checks.flatMap(([selector, what]) => {
      const seen = [...document.querySelectorAll(selector)].find(shown)
      if (!seen) {
        return []
      }
      const box =
        seen.closest('[role="alert"], [role="status"]') ?? seen.parentElement
      const words = box?.textContent.trim() || seen.outerHTML
      return [`${what} (${words.slice(0, 160)})`]
    })
  }, CONFUSING_ON_CAMERA)
}

// A step, in whatever it gave the report to point at. `say` first because it is
// the line the reader saw while the step was on screen.
function describeStep(step: VideoStep) {
  return (
    step.say ??
    step.selector ??
    step.text ??
    (step.type === 'delay' ? `delay ${step.ms}ms` : step.type)
  )
}

// The actions with somewhere on screen to be, which are the ones the drawn
// cursor travels to. A wait or a keypress has no target and must not move it:
// the pointer belongs where the last click left it.
const POINTED = new Set(['click', 'rightclick', 'hover', 'type', 'scroll'])
// ...and the ones that are already a wait, so a hold after them would be dead
// footage rather than a beat.
const UNHELD = new Set(['delay', 'waitForText', 'waitForSelector'])

// ---------------------------------------------------------------------------
// the camera
// ---------------------------------------------------------------------------

// A clip is filmed as one webm per on-camera stretch, stitched at encode time.
// `page.screencast` writes through ffmpeg's stdin, so the file is only complete
// once stop() has closed that pipe — which is why every stop is awaited and
// bounded rather than left to the process exiting.
// The page is read per segment rather than captured once: a tour that follows a
// launcher into a new tab films two pages, and `page.screencast` is bound to the
// one it was started on.
function camera(currentPage: () => Page, stem: string) {
  const segments: string[] = []
  let recorder: Awaited<ReturnType<Page['screencast']>> | undefined
  // ms the camera has been on, across every segment so far. The clip's own
  // clock: a cut costs the run wall time and the clip nothing, so this is what
  // a caption cue has to be timed against (video-captions.ts).
  let filmedMs = 0
  let openedAt = 0
  return {
    get recording() {
      return recorder !== undefined
    },
    get filmed() {
      return filmedMs + (recorder ? Date.now() - openedAt : 0)
    },
    segments,
    async start() {
      const file: `${string}.webm` = `${stem}.seg${segments.length}.webm`
      segments.push(file)
      recorder = await currentPage().screencast({ path: file, fps: FPS })
      openedAt = Date.now()
    },
    async stop() {
      const active = recorder
      recorder = undefined
      if (!active) {
        return
      }
      filmedMs += Date.now() - openedAt
      const outcome = await Promise.race([
        active
          .stop()
          .then(() => 'ok')
          .catch(
            (err: unknown) =>
              `stop rejected: ${err instanceof Error ? err.message : err}`,
          ),
        delay(15000).then(() => 'TIMEOUT after 15s'),
      ])
      if (outcome !== 'ok') {
        log(`  recorder.stop() -> ${outcome}`)
      }
    },
  }
}

// ---------------------------------------------------------------------------
// the motion
// ---------------------------------------------------------------------------

async function filmStep(
  page: Page,
  step: VideoStep,
  show: (line: string) => Promise<void>,
) {
  if (step.say !== undefined) {
    await show(step.say)
  }
  if (step.scrollTo !== undefined) {
    await scrollPage(page, step.scrollTo)
  }
  if (step.type === 'drag') {
    // filmed rather than delegated: runAction's stepped move finishes instantly,
    // so a drawn cursor gliding after it would trail the rubberband it is
    // supposed to be drawing. Both ends come from the same resolver the drag
    // itself uses, so an anchored rubberband is drawn where it is dragged.
    const { from, to } = await dragPoints(page, step)
    await dragCursor(page, from, to, { ms: step.dragMs })
  } else {
    if (POINTED.has(step.type)) {
      const point = await actionTargetPoint(page, step)
      if (point) {
        await moveCursor(page, point.x, point.y)
        if (step.type === 'click' || step.type === 'rightclick') {
          await clickPulse(page, point.x, point.y)
        }
      }
    }
    if (step.type === 'press' && step.key) {
      await keyPress(page, step.key)
    }
    const action = filmedAction(step)
    if (action.paste) {
      await keyPress(page, 'Ctrl V')
    }
    await runAction(page, action)
  }
  await delay(holdMs(step))
}

// The tab a step opened, once it exists. Armed BEFORE the click that opens it,
// since the target can arrive before the click's own promise settles.
function pendingTab(page: Page) {
  return new Promise<Page>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('opensTab: no new tab appeared within 30s'))
    }, 30000)
    page.once('popup', target => {
      clearTimeout(timer)
      if (target) {
        resolve(target)
      } else {
        reject(new Error('opensTab: the new tab arrived as null'))
      }
    })
  })
}

async function film(page: Page, spec: VideoSpec, stem: string) {
  const { width, height } = videoFrame(spec)
  // The page being filmed, which an `opensTab` step replaces.
  let stage = page
  const cam = camera(() => stage, stem)
  // What the app actually fills, at the start and at the end. A tour grows the
  // app (a launch adds a whole view), so one viewport has to serve both states
  // and neither number is guessable from the spec: too short clips the graph the
  // tour was filmed for, too tall is a frame of page background. Reported rather
  // than asserted (video-report.ts), because which way to trade is the author's.
  //
  // Off the view containers, never `documentElement.scrollHeight`: the app fills
  // the window and absorbs its own overflow in inner scroll containers, so the
  // document never reports being taller than the viewport even when the graph is
  // visibly cut in half. Same measurement, and the same reason, as the
  // screenshot run's below-the-fold report.
  //
  const contentHeight = () =>
    stage.evaluate(() =>
      Math.round(
        Math.max(
          0,
          ...Array.from(
            document.querySelectorAll('[data-testid^="view-container-"]'),
            el => el.getBoundingClientRect().bottom + window.scrollY,
          ),
        ),
      ),
    )
  // How far an open drawer's content runs, which is a DIFFERENT number and is
  // reported as one. A widget panel is laid out to the window's full height
  // whatever is in it, so its rect says nothing and its scrollHeight is what it
  // holds — and unlike a view, it is meant to scroll, so a panel taller than the
  // frame is the panel working. What it must not do is read as slack: a tour
  // whose whole subject is a drawer (a bookmark table, a feature-details
  // sequence panel) has views a third the height of its frame, and measuring
  // only those advised cutting the frame down onto the panel.
  const drawerHeight = () =>
    stage.evaluate(() =>
      Math.round(
        Math.max(
          0,
          ...Array.from(
            document.querySelectorAll('[data-testid="drawer-widget"]'),
            el => el.getBoundingClientRect().top + el.scrollHeight,
          ),
        ),
      ),
    )
  const openedAt = await contentHeight()
  // Sampled after every step, not only at the ends: a tour that switches layouts
  // and switches back is at its tallest in the middle, and a first/last reading
  // reports the frame as roomy while the state the tour was filmed for is cut
  // off the bottom.
  let tallest = openedAt
  let drawer = await drawerHeight()
  // Steps the camera stayed on for while the app was busy, which is what a
  // reader watches as a spinner. Named by what the step says or looks for, so
  // the report points at a line of the spec rather than at an index.
  const slowSteps: [string, number][] = []
  // What the viewer should not have seen, as [step, what]. Collected rather
  // than thrown at once, so the clip is still encoded to look at.
  const confusing: [string, string][] = []
  const captions = captionTrack()
  const filmedMs = () => cam.filmed
  // The line on screen, when it went up on the on-camera clock and how long it
  // needs. Replacing it waits out the remainder, on camera, so the frame it
  // explains is still there while it is read.
  let line = { text: '', at: 0, needs: 0 }
  // this step's share of that wait, which is reading rather than spinner
  let reading = 0
  const show = async (text: string) => {
    const unread = line.needs - (cam.filmed - line.at)
    if (unread > 0 && cam.recording) {
      await delay(unread)
      reading += unread
    }
    await setCaption(stage, text)
    captions.say(text, filmedMs())
    line = { text, at: cam.filmed, needs: readingMs(text) }
  }
  // Where the pointer waits while the goal is read. Top centre is a linear
  // view's overview strip, which writes the locus under the pointer into the
  // view's title bar and syncs a hover band into a graph track below it; the
  // wordmark is a bare <g> with no handler.
  const park = async () => {
    const mark = await stage.$('[aria-label="JBrowse"]')
    const box = await mark?.boundingBox()
    await (box
      ? moveCursor(stage, box.x + box.width / 2, box.y + box.height / 2)
      : moveCursor(stage, width / 2, 90))
  }
  // The payoff is held wherever the last click left the pointer, which is
  // usually over the data it changed, drawing a crosshair or a tooltip there.
  // A payoff that follows a hover is the hover's, so the pointer stays.
  const payoff = spec.steps.findLastIndex(step => step.say !== undefined)
  await injectOverlay(stage)
  await park()
  await delay(500)
  try {
    await cam.start()
    await show(spec.goal)
    for (const [i, step] of spec.steps.entries()) {
      if (i === payoff && spec.steps[i - 1]?.type !== 'hover') {
        await park()
      }
      // ON-CAMERA ms, not wall clock. A step that takes the camera off — a
      // `cut`, an `opensTab` — spends most of its wall time off it, and
      // measuring that reported the tab handoff as six seconds of spinner the
      // reader never sees.
      const startedAt = cam.filmed
      reading = 0
      if (step.cut) {
        if (cam.recording) {
          // the click that started this wait is still the last thing on screen;
          // hold it long enough to read before the cut
          await delay(PRE_CUT_MS)
          await cam.stop()
        }
      } else if (!cam.recording) {
        await cam.start()
      }
      // Armed before the click, since chrome can hand the target over before
      // the click's own promise settles.
      const tab = step.opensTab ? pendingTab(stage) : undefined
      await filmStep(stage, step, show)
      if (tab) {
        // The new tab loads off camera, the way a `cut` step's wait does: what
        // it opens with is a blank tab and then an app booting, and the reader
        // has already seen the click that asked for it.
        await delay(PRE_CUT_MS)
        await cam.stop()
        stage = await tab
        await stage.setViewport({
          width,
          height,
          deviceScaleFactor: DEVICE_SCALE,
        })
        await stage.bringToFront()
        await injectOverlay(stage)
        await setCaption(stage, line.text)
        await park()
      }
      // what the spec chose to hold, and the caption's reading time, are not
      // the app keeping anyone waiting
      const chosen =
        reading + holdMs(step) + (step.type === 'delay' ? (step.ms ?? 0) : 0)
      const waited = cam.filmed - startedAt - chosen
      if (!step.cut && waited > SLOW_STEP_MS) {
        slowSteps.push([describeStep(step), waited])
      }
      for (const what of await confusingOnCamera(stage)) {
        confusing.push([describeStep(step), what])
      }
      tallest = Math.max(tallest, await contentHeight())
      drawer = Math.max(drawer, await drawerHeight())
    }
    if (!cam.recording) {
      await cam.start()
    }
    const unread = line.needs - (cam.filmed - line.at)
    if (unread > 0) {
      await delay(unread)
    }
    await clearCaptionForTail(stage)
    captions.say('', filmedMs())
    await parkCursor(stage, height)
    await delay(spec.tailMs ?? TAIL_MS)
    const endedAt = await contentHeight()
    log(
      `  content ${openedAt}px at the first frame, ${endedAt}px at the last, ` +
        `${tallest}px at its tallest${
          drawer > 0 ? `, drawer content ${drawer}px` : ''
        }, in a ${height}px frame`,
    )
    return {
      segments: cam.segments,
      // The tail is filmed after the last line comes down, so the on-camera
      // total is read here rather than at the last cue: it is the denominator
      // the cues are scaled onto the clip with.
      cues: captions.end(filmedMs()),
      filmedMs: cam.filmed,
      content: { first: openedAt, last: endedAt, tallest, drawer },
      // Read here rather than after the encode: the tail is the last thing on
      // camera and the frame the poster comes from, and by the time ffmpeg has
      // run the page is closed.
      unpainted: await unpaintedDisplays(stage),
      slowSteps,
      confusing,
    }
  } catch (err) {
    // The frame the tour died on, which for a step that could not find its
    // target is the whole diagnosis: a menu that opened somewhere else, an item
    // this plugin build spells differently, a modal over the app.
    await debugDump(stage, spec.name)
    throw err
  } finally {
    await cam.stop()
  }
}

// ---------------------------------------------------------------------------
// encoding
// ---------------------------------------------------------------------------

function ffmpeg(args: string[]) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
  })
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

function probeSize(file: string) {
  return execFileSync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0',
    file,
  ])
    .toString()
    .trim()
}

// One filter graph over every segment: concatenate, then scale DOWN to the
// delivery width if the capture was wider. `min(w,iw)` rather than a bare `w`,
// because a run whose frames came back at 1x must not be upscaled — that would
// claim a resolution the pixels do not have.
function concatFilter(segments: string[]) {
  const inputs = segments.map((_, i) => `[${i}:v]`).join('')
  return [
    ...segments.flatMap(s => ['-i', s]),
    '-filter_complex',
    `${inputs}concat=n=${segments.length}:v=1:a=0[cat];` +
      `[cat]scale='min(${OUTPUT_WIDTH},iw)':-2:flags=lanczos,fps=${FPS},format=yuv420p[out]`,
    '-map',
    '[out]',
  ]
}

function encode(segments: string[], stem: string) {
  const mp4 = `${stem}.mp4`
  ffmpeg([
    ...concatFilter(segments),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    // the moov atom in front, so a browser can start playing before the whole
    // file has arrived
    '-movflags',
    '+faststart',
    mp4,
  ])
  // The mp4 is what carries a real duration (a webm piped out of the screencast
  // reports `duration=N/A` at the container level, which is normal and not a
  // truncation), so it is what proves the capture finished.
  const duration = probeDuration(mp4)
  if (!duration) {
    throw new Error(`${mp4} has no duration — the capture was truncated`)
  }
  return { mp4, duration }
}

// The still a reader sees before pressing play, and the image a card would use:
// the middle of the payoff line, which is held over the state the tour was
// filmed to reach. Not the last frame, which a hover payoff has already left
// once the tail parks the pointer.
function poster(
  mp4: string,
  stem: string,
  cues: readonly Cue[],
  scale: number,
  duration: number,
) {
  const jpg = `${stem}.jpg`
  const payoff = cues.at(-1)
  const last = Math.max(0, duration - 0.2)
  const at = payoff
    ? Math.min(last, ((payoff.startMs + payoff.endMs) / 2000) * scale)
    : last
  ffmpeg(['-ss', at.toFixed(2), '-i', mp4, '-frames:v', '1', '-q:v', '3', jpg])
  return jpg
}

// ---------------------------------------------------------------------------

async function main() {
  if (values.help) {
    console.log(
      'generate-video [--filter name] [--headed] [--list] [--keep-segments]',
    )
    return
  }
  const tokens = parseFilterTokens(values.filter)
  const selected = tokens.length
    ? videoSpecs.filter(s => matchesFilterTokens(s.name, tokens, false))
    : videoSpecs
  // Before anything is filmed: an odd viewport side fails the encode after the
  // capture, and a duplicate name overwrites a published clip. Over the tours
  // about to be filmed; check-video-specs.ts runs them over the whole list.
  const specProblems = validateVideoSpecs(
    selected,
    pastedTrackConfigs.map(pair => pair.video),
  )
  if (specProblems.length > 0) {
    console.error(
      `${specProblems.length} video spec problem(s):\n${specProblems
        .map(p => `  - ${p}`)
        .join('\n')}`,
    )
    process.exit(1)
  }
  if (values.list) {
    for (const spec of videoSpecs) {
      const { width, height } = videoFrame(spec)
      console.log(
        `${spec.name}  ${width}×${height}, ${spec.steps.length} steps\n    ${spec.description}`,
      )
    }
    for (const clip of externalClips) {
      console.log(
        `${clip.name}  ${clip.width}×${clip.height}, filmed elsewhere\n    ${clip.description}`,
      )
    }
    return
  }
  if (!selected.length) {
    // Naming one of those and being told nothing matched reads as a typo in the
    // name, which is the one thing it is not.
    const external = externalClips.filter(c =>
      matchesFilterTokens(c.name, tokens, false),
    )
    console.error(
      external.length
        ? `${external.map(c => c.name).join(', ')} is filmed outside this generator and cannot be re-filmed by it — see externalClips in video-specs.ts`
        : `no video spec matches ${values.filter?.join(', ')}`,
    )
    process.exit(1)
  }

  if (!values['no-build']) {
    buildJbrowseWeb()
  }

  const failures: string[] = []
  await withHarness(
    { port: PORT, headless: !values.headed, protocolTimeout: 300000 },
    async ({ browser }) => {
      for (const spec of selected) {
        const stem = path.join(outDir, spec.name)
        fs.mkdirSync(path.dirname(stem), { recursive: true })
        const page = await browser.newPage()
        // Surface a tab crash or an uncaught page error here rather than as the
        // "Target closed" the next command would report.
        page.on('error', err => {
          log(`PAGE CRASH: ${err.message}`)
        })
        page.on('pageerror', (err: unknown) => {
          log(`PAGE ERROR: ${err instanceof Error ? err.message : String(err)}`)
        })
        // A tour reaches further out than a figure does — a launcher on another
        // site, a tabix index on a public host — and every one of its waits
        // fails the same way, as a selector that never turned up. What the
        // network was doing at that moment is the difference between a spec to
        // fix and a host that is down.
        const net = trackNetwork(page)
        let segments: string[] = []
        try {
          await page.setViewport({
            ...videoFrame(spec),
            deviceScaleFactor: DEVICE_SCALE,
          })
          // The pangenome configs declare the GraphGenomeView plugin by url, and
          // its cross-origin warning is a modal over the whole app. Written
          // before any app script runs, so SessionLoader reads it at startup.
          await trustCapturePlugins(page)
          log(`${spec.name}: loading`)
          const url = spec.url.startsWith('http')
            ? spec.url
            : `http://localhost:${PORT}/${spec.url}`
          await page.goto(pinRenderer(url), {
            waitUntil: spec.url.startsWith('http')
              ? 'domcontentloaded'
              : 'networkidle0',
            timeout: Math.max(60000, spec.readyTimeout ?? 0),
          })
          // The whole readiness stack the stills use, so a tour opens on the
          // same settled app a figure is captured from. Everything it waits out
          // happens before the camera starts.
          await waitForReady(page, {
            mode: 'url',
            name: spec.name,
            url: spec.url,
            noSession: spec.noSession,
            readyText: spec.readyText,
            readySelector: spec.readySelector,
            readyTimeout: spec.readyTimeout,
          })
          log(`${spec.name}: filming`)
          const filmed = await film(page, spec, stem)
          segments = filmed.segments
          const { mp4, duration } = encode(segments, stem)
          // The lines the tour said, onto the clip's own clock. Scaled by what
          // the encode actually produced over what the run counted on camera —
          // the two are the same measurement of different things, and a cue
          // past the end of the clip is a cue that never shows.
          const scale =
            filmed.filmedMs > 0 ? (duration * 1000) / filmed.filmedMs : 1
          const jpg = poster(mp4, stem, filmed.cues, scale, duration)
          writeVtt(`${stem}.vtt`, filmed.cues, scale)
          const mb = (f: string) =>
            `${(fs.statSync(f).size / 1e6).toFixed(2)} MB`
          log(
            `${spec.name}: ${duration.toFixed(1)}s ${probeSize(mp4)} ` +
              `mp4 ${mb(mp4)}, poster ${mb(jpg)}, ` +
              `${filmed.cues.length} caption(s)`,
          )
          recordFilmed({
            name: spec.name,
            frame: videoFrame(spec),
            content: filmed.content,
            unpainted: filmed.unpainted,
            slowSteps: filmed.slowSteps,
            confusing: filmed.confusing,
            seconds: duration,
            mp4Bytes: fs.statSync(mp4).size,
            posterBytes: fs.statSync(jpg).size,
          })
          if (filmed.confusing.length > 0) {
            failures.push(spec.name)
            log(
              `${spec.name}: FAILED, filmed ${filmed.confusing
                .map(([step, what]) => `${what} after "${step}"`)
                .join('; ')}`,
            )
          }
        } catch (err: unknown) {
          failures.push(spec.name)
          log(`${spec.name}: FAILED${describeNetwork(net)}`)
          console.error(err)
        } finally {
          if (!values['keep-segments']) {
            for (const s of segments) {
              fs.rmSync(s, { force: true })
            }
          }
          await page.close()
        }
      }
    },
  )
  printVideoSummary(failures)
  if (failures.length) {
    console.error(
      `\n${failures.length} video(s) failed: ${failures.join(', ')}`,
    )
    process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
