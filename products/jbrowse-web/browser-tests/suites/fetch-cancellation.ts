import {
  delay,
  waitForDisplaysDone,
  waitForViewPhases,
} from '@jbrowse/browser-test-utils'

import { navigateWithSessionSpec } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { CDPSession, HTTPRequest, Page } from 'puppeteer'

// End-to-end cover for cancellation, which is close to untestable in jest: the
// mechanisms are a worker postMessage, a synchronous XHR that only runs in a
// worker global, and an AbortSignal whose entire purpose is what it does to a
// socket. All three are inert or absent under jsdom — which is how a deletion of
// the synchronous-probe path once passed every unit test in the repo. See
// packages/core/src/util/stopToken.ts.
//
// EVERY TEST HERE ASSERTS ITS OWN PRECONDITION, and that is not ceremony: the
// first version of this file passed 3 of 4 while the app under test had not
// finished booting and no BAM read had been issued at all. The display-phase
// waits in browser-test-utils are deliberately best-effort (they swallow their
// own timeout), so "wait, then assert nothing went wrong" is a test that cannot
// fail. If you add a case, give it a precondition that throws.
//
// Three properties of the fixture shape the setup, all learned the hard way:
//   - the alignments track unmounts above ~25 bp/px, so a wide window fetches
//     NOTHING. The windows below stay at ~5 bp/px, where a 2000x pileup issues a
//     real range read.
//   - reads are cached per 256 KiB chunk, so revisiting a region issues no
//     request. Each window below is somewhere the previous ones did not touch.
//   - the fixture sets `forceLoad` on its display, and needs to. The very depth
//     that makes this file worth cancelling puts it over the region-too-large
//     byte gate: 4kb of a ~2000x BAM measures 7.37 Mb against BamAdapter's 5 Mb
//     `fetchSizeLimit`, so the display banners instead of fetching a thing. That
//     used to be masked by AUTO_FORCE_LOAD_BP turning the byte axis off below
//     20kb; the axis has no floor any more, since it measures at the span it
//     judges rather than assuming a small span is a small fetch
//     (REGION_TOO_LARGE.md). Zooming in is not the way out, though it is what
//     the banner advises: a smaller window is a smaller read, and a read these
//     tests can still catch in flight 2.5s into a throttled download is the
//     whole point of picking a ~2000x file. The other three drivers of this
//     fixture (cancel-bench, profile-ultradeep, profile-retained) want the fetch
//     for the same reason, which is why the opt-in belongs in the config rather
//     than here.

const ULTRADEEP = 'extra_test_data/volvox-ultradeep.json'
const BOOT_LOC = 'ctgA:1000-5000'
const FIRST_LOC = 'ctgA:20000-24000'
const SUPERSEDING_LOC = 'ctgA:40000-44000'
const BAM = 'volvox-ultradeep.bam'

// `volvox-ultradeep.bam` is a *prefix* of `volvox-ultradeep.bam.bai`, so a
// substring test counts an aborted index read as an aborted alignment read. It
// happens to be inert today — the index is fetched once during boot, before
// these listeners attach — but it is exactly the shape this file's header warns
// about, since the day something re-reads the index mid-navigation the abort
// assertion below starts passing on the wrong request and says nothing. Match
// the path.
const isBamRead = (url: string) => new URL(url).pathname.endsWith(`/${BAM}`)

interface CancelProbe {
  blobUrls: number
  stopFrames: number
}

interface RequestRecord {
  url: string
  errorText?: string
}

// Counts the two observable signs of the machinery: blob-URL stop tokens minted
// on the main thread, and stop-token frames posted into a worker. Installed
// before any app code runs.
async function installProbe(page: Page) {
  await page.evaluateOnNewDocument(() => {
    const probe: CancelProbe = { blobUrls: 0, stopFrames: 0 }
    ;(window as unknown as { __cancelProbe: CancelProbe }).__cancelProbe = probe
    const createObjectURL = URL.createObjectURL
    URL.createObjectURL = function (obj: Blob | MediaSource) {
      probe.blobUrls++
      return createObjectURL.call(URL, obj)
    }
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (
      this: Worker,
      message: unknown,
      ...rest
    ) {
      if (
        message !== null &&
        typeof message === 'object' &&
        typeof (message as { stopToken?: unknown }).stopToken === 'string'
      ) {
        probe.stopFrames++
      }
      post.apply(this, [message, ...rest] as Parameters<typeof post>)
    } as typeof post
  })
}

async function readProbe(page: Page) {
  const probe = await page.evaluate(
    () =>
      (window as unknown as { __cancelProbe: CancelProbe | undefined })
        .__cancelProbe,
  )
  if (!probe) {
    throw new Error('probe was not installed; the page reloaded without it')
  }
  return probe
}

function navToLocString(page: Page, loc: string) {
  return page.evaluate((l: string) => {
    const w = window as unknown as {
      JBrowseSession: { views: { navToLocString: (s: string) => void }[] }
    }
    w.JBrowseSession.views[0]!.navToLocString(l)
  }, loc)
}

function displayPhases(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-display-phase]')].map(
      el => el.dataset.displayPhase,
    ),
  )
}

/**
 * Why the DOM census came back empty, asked of the models rather than the DOM.
 *
 * The two subtree-replacing phases (`tooLarge`, `renderError`) render their
 * banner *instead of* the element carrying `data-display-phase`, so a display in
 * either counts as absent above rather than as terminal — deliberately, see
 * DISPLAYCHROME.md. That makes `[]` the likeliest precondition failure here and
 * the least self-explanatory: it reads as "the app never booted" when it in fact
 * means "a display booted and gave up". It cost a full rebuild to tell those
 * apart once (the byte gate reaching this fixture), which is the whole reason
 * this exists. The model carries both terms directly, so ask it.
 */
function displayDiagnosis(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as {
      JBrowseSession?: {
        views: {
          tracks: {
            displays: {
              type: string
              displayPhase?: string
              regionTooLargeReason?: string
              error?: unknown
            }[]
          }[]
        }[]
      }
    }
    return (w.JBrowseSession?.views[0]?.tracks ?? []).flatMap(t =>
      t.displays.map(d => ({
        type: d.type,
        phase: d.displayPhase,
        tooLargeReason: d.regionTooLargeReason || undefined,
        error: d.error ? String(d.error) : undefined,
      })),
    )
  })
}

function waitForNoLoadingDisplay(page: Page) {
  return page.waitForFunction(
    () => document.querySelector('[data-display-phase="loading"]') === null,
    { timeout: 120000, polling: 500 },
  )
}

/**
 * Boot the app and wait until a display genuinely exists and has finished. Built
 * on the non-best-effort waits, because this is the precondition every test here
 * depends on and a failure to reach it has to surface as a failure.
 */
async function loadUltradeep(page: Page) {
  await installProbe(page)
  await navigateWithSessionSpec(
    page,
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: BOOT_LOC,
          tracks: ['volvox_ultradeep'],
        },
      ],
    },
    ULTRADEEP,
  )
  await waitForViewPhases(page, 120000)
  await page.waitForSelector('[data-display-phase]', { timeout: 120000 })
  await waitForNoLoadingDisplay(page)
  await waitForDisplaysDone(page, 120000)
  const phases = await displayPhases(page)
  if (!phases.includes('ready')) {
    throw new Error(
      `expected a ready alignments display before cancelling, got ${JSON.stringify(phases)}; displays report ${JSON.stringify(await displayDiagnosis(page))}`,
    )
  }
}

// Squeeze the pipe so a range read cannot complete before the next navigation
// supersedes it. Unthrottled these reads take ~150ms, which no amount of
// well-chosen delay reliably interrupts. Applied only after boot — throttling
// during boot starves the lazily-loaded app chunks and nothing ever mounts.
async function throttle(page: Page) {
  const client = await page.createCDPSession()
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 50,
    downloadThroughput: 50 * 1024,
    uploadThroughput: 50 * 1024,
  })
  return client
}

async function unthrottle(client: CDPSession) {
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
  await client.detach()
}

/**
 * Navigate somewhere that needs a fresh read, let it genuinely get underway, then
 * supersede it. Returns every BAM request seen, and **throws if none started** —
 * a run where nothing was in flight proves nothing about aborting.
 */
async function cancelMidFetch(page: Page) {
  const requests: RequestRecord[] = []
  const failures: RequestRecord[] = []
  const onRequest = (req: HTTPRequest) => {
    if (isBamRead(req.url())) {
      requests.push({ url: req.url() })
    }
  }
  const onFailed = (req: HTTPRequest) => {
    failures.push({
      url: req.url(),
      errorText: req.failure()?.errorText ?? '',
    })
  }
  page.on('request', onRequest)
  page.on('requestfailed', onFailed)
  const client = await throttle(page)
  try {
    await navToLocString(page, FIRST_LOC)
    // past the 600ms fetch debounce and well into the throttled read
    await delay(2500)
    await navToLocString(page, SUPERSEDING_LOC)
    await delay(2500)
  } finally {
    await unthrottle(client)
    page.off('request', onRequest)
    page.off('requestfailed', onFailed)
  }
  if (requests.length === 0) {
    throw new Error(
      'no BAM read was issued, so this run cannot show anything about cancellation — check the zoom-threshold and chunk-cache notes at the top of this file',
    )
  }
  return { requests, failures }
}

const suite: TestSuite = {
  name: 'FetchCancellation',
  tests: [
    {
      name: 'superseding a fetch aborts its in-flight range request',
      fn: async page => {
        await loadUltradeep(page)
        const { requests, failures } = await cancelMidFetch(page)
        const aborted = failures.filter(f =>
          f.errorText?.includes('ERR_ABORTED'),
        )
        // The assertion that the AbortSignal reaches the socket. Before
        // stopTokenSignal existed a superseded fetch discarded its result but
        // downloaded every byte first, and this list was empty.
        if (aborted.length === 0) {
          throw new Error(
            `expected an aborted BAM request out of ${requests.length} issued; failures were ${JSON.stringify(failures.slice(0, 5))}`,
          )
        }
        if (!aborted.some(f => isBamRead(f.url))) {
          throw new Error(
            `aborts did not include the BAM read: ${JSON.stringify(aborted.slice(0, 5))}`,
          )
        }
      },
    },
    {
      name: 'a superseded fetch notifies the worker it was stopped',
      fn: async page => {
        await loadUltradeep(page)
        const before = await readProbe(page)
        await cancelMidFetch(page)
        const after = await readProbe(page)
        // The frame is what lets an already-running worker call see the stop at
        // its next await boundary; zero of them means cancellation is silently
        // doing nothing on the message path.
        if (after.stopFrames <= before.stopFrames) {
          throw new Error(
            `expected stop-token frames to be posted to the worker, went from ${before.stopFrames} to ${after.stopFrames}`,
          )
        }
      },
    },
    {
      name: 'string stop tokens are blob URLs, so a sync loop stays cancellable',
      fn: async page => {
        await loadUltradeep(page)
        const isolated = await page.evaluate(() => self.crossOriginIsolated)
        // Without cross-origin isolation there is no SharedArrayBuffer, so the
        // revocable blob URL is the ONLY thing that can interrupt an await-free
        // worker loop (getLDMatrix's O(n^2) fill is the case). If this ever runs
        // isolated the assertion is vacuous, so fail rather than pass quietly.
        if (isolated) {
          throw new Error(
            'expected a non-isolated page; SharedArrayBuffer would mask the blob-token path this asserts',
          )
        }
        const { blobUrls } = await readProbe(page)
        if (blobUrls === 0) {
          throw new Error(
            'no blob-URL stop tokens were minted, so nothing can interrupt a synchronous worker loop',
          )
        }
      },
    },
    {
      name: 'a display recovers and loads after its fetch was cancelled',
      fn: async page => {
        await loadUltradeep(page)
        await cancelMidFetch(page)
        // Guards over-aggressive aborting: a cancelled read shares 256 KiB chunk
        // fetches with its siblings (RemoteFileWithRangeCache) and bgzf chunks
        // with other queries (@gmod/bam), so tearing one down can strand a read
        // that was never cancelled — which surfaces here as a display stuck
        // loading, or in error.
        await waitForNoLoadingDisplay(page)
        const phases = await displayPhases(page)
        if (!phases.includes('ready')) {
          throw new Error(
            `display did not recover after a cancelled fetch, phases: ${JSON.stringify(phases)}`,
          )
        }
      },
    },
  ],
}

export default suite
