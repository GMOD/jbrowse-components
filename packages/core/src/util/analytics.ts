import {
  effectiveRenderer,
  getGraphicsCapabilities,
} from '@jbrowse/render-core/graphicsCapabilities'

import { readConfObject } from '../configuration/index.ts'
import { isElectron, rIC } from '../util/index.ts'
import {
  createSessionActivity,
  describeSession,
  tallyTypes,
} from './sessionActivity.ts'
import { getConfAssemblyNamesOrNone } from './tracks.ts'

import type {
  AnyConfigurationModel,
  TrackConfigEntry,
} from '../configuration/index.ts'
import type { ActivitySession } from './sessionActivity.ts'

declare global {
  interface Window {
    ga?: (...args: unknown[]) => void
  }
}

type StatValue = string | number | boolean | undefined
type AnalyticsObj = Record<string, StatValue>

interface AnalyticsRootModel {
  jbrowse: {
    tracks: TrackConfigEntry[]
    assemblies: unknown[]
    plugins?: { name?: string }[]
  }
  session?: ActivitySession
  version: string
}

const analyticsUrl = 'https://analytics.jbrowse.org/api/v1'

// Ties a page load's end reports to its start report. It lives in memory only,
// so a reload gets a new one and nothing follows a user from load to load.
let pageLoadId: string | undefined
function getPageLoadId() {
  pageLoadId ??=
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return pageLoadId
}

// Names only, and only JBrowse's own: says whether a load was a link to a
// location or a set of tracks without saying which. Read when this module
// loads, because jbrowse-web folds `loc`, `tracks` and `assembly` into a
// `session` parameter before the report goes out.
const knownUrlParams = [
  'assembly',
  'config',
  'highlight',
  'loc',
  'nav',
  'session',
  'sessionName',
  'sessionTracks',
  'tracklist',
  'tracks',
]
export function urlParamNames(search: string) {
  const params = new URLSearchParams(search)
  return knownUrlParams.filter(name => params.has(name)).join(',')
}
const initialUrlParams =
  typeof window === 'undefined' ? '' : urlParamNames(window.location.search)

function sessionTrackTypeCounts(session: ActivitySession | undefined) {
  const counts: Record<string, number> = {}
  for (const track of session?.sessionTracks ?? []) {
    const key = `sessionTrack-types-${track.type}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

async function send(stats: AnalyticsObj, init?: RequestInit) {
  const qs = new URLSearchParams(
    Object.entries(stats).map(([key, value]) => [key, String(value)]),
  ).toString()
  await fetch(`${analyticsUrl}?${qs}`, init)
}

// only doAnalytics reads the configuration, for the disableAnalytics slot
type AnalyticsRootModelWithConfig = AnalyticsRootModel & {
  jbrowse: { configuration: AnyConfigurationModel }
}

// Both writers are fire-and-forget from several call sites, so they swallow
// their own failures rather than rejecting: a floating rejected promise trips
// the webpack-dev-server overlay (it listens for unhandledrejection), and an
// analytics ping is never worth interrupting a session for.
export async function writeAWSAnalytics(
  rootModel: AnalyticsRootModel,
  initialTimestamp: number,
  sessionQuery?: string | null,
) {
  try {
    const multiAssemblyTracks = rootModel.jbrowse.tracks.filter(
      track => getConfAssemblyNamesOrNone(track).length > 1,
    ).length

    // The rung createGpuHal built where a display has built one by idle time,
    // else the ladder's prediction with any page-wide pin applied — so a
    // session that fell back to Canvas2D is counted as Canvas2D rather than as
    // what the hardware could have done.
    const capabilities = await getGraphicsCapabilities()
    const renderer = effectiveRenderer(capabilities)
    // The coarse bit only. `glRenderer` names the exact driver and stays local
    // to the stack-trace dialog, the same line vendor/architecture hold — this
    // says whether a WebGL2 user is on a rasterizer, which is the population
    // that pays ~25x Canvas2D on the main thread and the number that decides
    // whether the ladder should route around it. 'unknown' where nothing probed
    // or the browser withholds the extension, which must not read as 'false'.
    const softwareRendering = capabilities.softwareWebgl ?? 'unknown'

    const { jbrowse: config, session, version: ver } = rootModel
    const { tracks, assemblies, plugins } = config
    const shape = describeSession(session)

    // stats to be recorded in db
    const stats: AnalyticsObj = {
      event: 'start',
      sid: getPageLoadId(),
      ver,
      'plugins-count': plugins?.length ?? 0,
      'plugin-names': plugins?.map(p => p.name).join(','),
      'assemblies-count': assemblies.length,
      'tracks-count': tracks.length,
      'session-tracks-count': session?.sessionTracks.length ?? 0,
      'open-views': session?.views.length ?? 0,
      'view-types': tallyTypes(shape.viewTypes),
      'open-track-types': tallyTypes(shape.trackTypes),
      'url-params': initialUrlParams,
      'synteny-tracks-count': multiAssemblyTracks,

      // No `saved-sessions-count`: it counted localStorage keys matching
      // `localSaved-`, a format nothing has written since autosaved sessions
      // moved to IndexedDB (`sessionsDB`), so it reported 0 for every user. The
      // live count is `savedSessionMetadata`, which is web-only and populated by
      // an async open — reporting it here would race the boot rather than
      // measure anything, so the field is gone instead of re-sourced.

      // field if existing session param in query before autogenerated param
      'existing-session-param-type': sessionQuery?.split('-', 1)[0] || 'none',

      // screen geometry
      'scn-h': window.screen.height,
      'scn-w': window.screen.width,

      // window geometry
      'win-h': window.innerHeight,
      'win-w': window.innerWidth,
      dpr: window.devicePixelRatio,

      electron: isElectron,
      renderer,
      'software-rendering': softwareRendering,
      loadTime: (Date.now() - initialTimestamp) / 1000,
      jb2: true,
    }

    // tallies get processed in the lambda, keyed as e.g. track-types-FeatureTrack
    const trackTypeCounts: Record<string, number> = {}
    for (const track of tracks) {
      const key = `track-types-${track.type}`
      trackTypeCounts[key] = (trackTypeCounts[key] ?? 0) + 1
    }

    Object.assign(stats, trackTypeCounts, sessionTrackTypeCounts(session))

    await send(stats)
  } catch (e) {
    console.warn('Failed to write analytics to AWS.', e)
  }
}

export async function writeGAAnalytics(
  rootModel: AnalyticsRootModel,
  initialTimestamp: number,
) {
  try {
    const jbrowseUser = 'UA-7115575-5'
    const loadTime = Date.now() - initialTimestamp

    // custom dimension/metric indices are wired up on the GA property side, so
    // this order (tracks-count, ver, electron, loadTime, pluginNames) must stay
    // dimension1..5
    const gaData: AnalyticsObj = {
      dimension1: rootModel.jbrowse.tracks.length, // this is all possible tracks
      dimension2: rootModel.version,
      dimension3: isElectron,
      dimension4: loadTime,
      dimension5: rootModel.jbrowse.plugins?.map(p => p.name).join(',') ?? '',
      metric1: Math.round(loadTime),
    }

    // Plugin names come from the loaded config and are not trusted content (a
    // config can be loaded from an arbitrary URL). Only this static bootstrap,
    // with no interpolated data, is ever parsed as script source; gaData is
    // handed to ga() as a real JS value afterward so untrusted strings can never
    // break out of the <script> tag the way interpolating them into it would.
    const analyticsBootstrap =
      "(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){" +
      '(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),' +
      'm=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)' +
      "})(window,document,'script','https://www.google-analytics.com/analytics.js','ga');"

    const analyticsScriptNode = document.createElement('script')
    analyticsScriptNode.innerHTML = analyticsBootstrap
    document.head.append(analyticsScriptNode)

    window.ga?.('create', jbrowseUser, 'auto', 'jbrowseTracker')
    window.ga?.('jbrowseTracker.send', 'pageview', gaData)
  } catch (e) {
    console.warn('Failed to write analytics to GA.', e)
  }
}

// What the page load's sessions held while in use, for the end report.
const activity = createSessionActivity()
let latestRootModel: AnalyticsRootModel | undefined
let endReportsInstalled = false
let endReportsSent = 0
let lastEndSignature: string | undefined
let visibleMs = 0
let visibleSince: number | undefined
let visibleMsAtLastEnd = 0

const maxEndReports = 10
const resendAfterVisibleMs = 60_000

// The end report says what a session came to hold: the view, track and widget
// types open when the tab was hidden and those opened at any point before.
// A tab is hidden many times before it closes and the close itself is not
// reliably observable, so each hide sends one, numbered by `seq`, when the
// session changed or another minute was spent on the page. The last one for a
// `sid` is the session's end.
export async function writeAWSSessionEnd() {
  try {
    if (!activity.watching || endReportsSent >= maxEndReports) {
      return
    }
    const seen = activity.stats()
    const signature = JSON.stringify(seen)
    if (
      signature === lastEndSignature &&
      visibleMs - visibleMsAtLastEnd < resendAfterVisibleMs
    ) {
      return
    }
    lastEndSignature = signature
    visibleMsAtLastEnd = visibleMs
    endReportsSent += 1

    const stats: AnalyticsObj = {
      event: 'end',
      sid: getPageLoadId(),
      seq: endReportsSent,
      duration: Math.round(performance.now() / 1000),
      'visible-time': Math.round(visibleMs / 1000),
      ...seen,
      electron: isElectron,
      jb2: true,
    }
    try {
      const { session, version } = latestRootModel ?? {}
      stats.ver = version
      stats['session-tracks-count'] = session?.sessionTracks.length ?? 0
      Object.assign(stats, sessionTrackTypeCounts(session))
    } catch {
      // root model left its state tree; the accumulated types still go out
    }
    // keepalive lets the request outlive the page it was sent from
    await send(stats, { keepalive: true })
  } catch (e) {
    console.warn('Failed to write analytics to AWS.', e)
  }
}

function installEndReports() {
  if (!endReportsInstalled) {
    endReportsInstalled = true
    if (document.visibilityState === 'visible') {
      visibleSince = performance.now()
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (visibleSince !== undefined) {
          visibleMs += performance.now() - visibleSince
          visibleSince = undefined
        }
        void writeAWSSessionEnd()
      } else {
        visibleSince = performance.now()
      }
    })
  }
}

// One pageview per page load, not per pluginManager. jbrowse-web rebuilds the
// whole pluginManager (and rootModel) whenever plugins change, and StrictMode
// builds it twice on mount — without this guard each rebuild re-pings AWS and
// appends another Google Analytics <script> to <head>, inflating pageviews and
// growing the document on every plugin install.
let analyticsSent = false

export function doAnalytics(
  rootModel: AnalyticsRootModelWithConfig | undefined,
  initialTimestamp: number,
  initialSessionQuery: string | null | undefined,
) {
  if (!rootModel) {
    return
  }
  // a config that opts out stops the end reports too, whichever config or
  // session started them
  if (readConfObject(rootModel.jbrowse.configuration, 'disableAnalytics')) {
    activity.stop()
    return
  }
  latestRootModel = rootModel
  activity.watch(() => rootModel.session)
  installEndReports()
  if (!analyticsSent) {
    analyticsSent = true
    // writeGAAnalytics injects Google's scripts and writeAWSAnalytics probes
    // graphics capabilities, hundreds of ms of main-thread work together. Idle
    // time alone is not late enough: a load spends most of its time idle,
    // waiting on the network, so rIC ran them mid-boot. The writers measure
    // loadTime up to when they run, so the start they get is moved forward by
    // the wait, and loadTime still ends here.
    const calledAt = Date.now()
    afterAppReady(() => {
      rIC(() => {
        const start = initialTimestamp + (Date.now() - calledAt)
        void writeAWSAnalytics(rootModel, start, initialSessionQuery)
        void writeGAAnalytics(rootModel, start)
      })
    })
  }
}

// `[data-app-phase="ready"]`, or a timeout for a page that never shows one
// (Desktop's start screen)
function afterAppReady(callback: () => void, maxWaitMs = 10_000) {
  const doc = document
  const isReady = () => doc.querySelector('[data-app-phase="ready"]') !== null
  if (isReady()) {
    callback()
    return
  }
  let done = false
  const finish = () => {
    if (!done) {
      done = true
      observer.disconnect()
      clearTimeout(timer)
      callback()
    }
  }
  const observer = new MutationObserver(() => {
    if (isReady()) {
      finish()
    }
  })
  const timer = setTimeout(finish, maxWaitMs)
  observer.observe(doc.body, {
    subtree: true,
    childList: true,
    attributeFilter: ['data-app-phase'],
  })
}
