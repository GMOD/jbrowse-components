import {
  getReExportRegistry,
  setReExportRegistry,
} from '@jbrowse/core/ReExports/registry'
import {
  getConf,
  getConfigurationSchemaDefinition,
  getConfigurationSchemaOptions,
  isConfigurationSubschema,
  isSlotDefinitionEntry,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  releaseAdapterSession,
  retainAdapterSession,
} from '@jbrowse/core/data_adapters/adapterSessionRefcount'
import { adapterConfigCacheKey } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { adapterByteLimit } from '@jbrowse/core/rpc/byteBudget'
import {
  isElectron,
  isSessionWithAddSessionTrack,
  objectHash,
  parseLocString,
} from '@jbrowse/core/util'
import {
  openTracks,
  openViews,
  viewAndNested,
} from '@jbrowse/core/util/openViews'
import {
  allSessionTracks,
  getConfAssemblyNamesOrNone,
  guessTrackConfForLocation,
  isSameAssemblyName,
  viewCanDisplayTrack,
  viewDisplayNames,
} from '@jbrowse/core/util/tracks'
import { unknownKeysMessage } from '@jbrowse/core/util/withLaunchInput'
import * as mst from '@jbrowse/mobx-state-tree'
import {
  applySnapshot,
  getSnapshot,
  getType,
  isStateTreeNode,
} from '@jbrowse/mobx-state-tree'
import * as mobx from 'mobx'

// relative, not '@jbrowse/app-core': a package self-import would make this
// module depend on the barrel that exports it
import {
  launchSpecView,
  launchableSpecView,
  loadSessionSpec,
  viewTypeProblem,
} from '../SessionSpec/index.ts'

import type { ViewSpec } from '../SessionSpec/index.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes/models'
import type {
  AbstractSessionModel,
  AbstractViewModel,
  FileLocation,
} from '@jbrowse/core/util/types'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// Matches BaseTrackModel's DEFAULT_EXPORT_BYTE_LIMIT: both bound a fetch
// someone asked for by name rather than one a view scrolled into, so they
// should refuse at the same size.
const DEFAULT_AGENT_BYTE_LIMIT = 5_000_000

/**
 * What jb.getFeatures may pull before it refuses. An explicit request wins so
 * an agent can mean it; otherwise the adapter's own declared limit, so this
 * does not disagree with the size the track's display already refuses to
 * render; otherwise the default.
 */
export function agentByteLimit(
  declaredFetchSizeLimit: unknown,
  requested?: number,
) {
  return (
    requested ??
    adapterByteLimit(declaredFetchSizeLimit, DEFAULT_AGENT_BYTE_LIMIT)
  )
}

// What the handlers ask of a view, duck-typed the way loadSessionSpec
// duck-types the session: the concrete view models live in plugins this module
// must not import, so members are optional and presence is the capability
// check.
interface DisplaySelf {
  type: string
  configuration: AnyConfigurationModel
  displayPhase?: string
  regionTooLargeReason?: string
  height?: number
  error?: unknown
  // its own volatile, and the term that outranks every other in
  // computeDisplayPhase — so a display whose renderer threw reports
  // phase: 'renderError' and, without this, nothing to act on
  renderError?: unknown
}

interface TrackSelf extends IStateTreeNode {
  type: string
  configuration: AnyConfigurationModel & { trackId: string }
  activeDisplay?: Record<string, unknown> & DisplaySelf
}

interface ViewSelf {
  id: string
  type: string
  displayName?: string
  assemblyNames?: string[]
  coarseVisibleLocStrings?: string
  height?: number
  initialized?: boolean
  // the launch blob the view is still applying, if any — see viewState
  pendingLaunch?: unknown
  error?: unknown
  visibleRegions?: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }[]
  navToLocString?: (input: string) => Promise<unknown>
  showTrack?: (
    trackId: string,
    initialSnapshot?: object,
    displayInitialSnapshot?: Record<string, unknown>,
  ) => unknown
  // the awaitable one, and the only correct choice here: showTrack returns
  // undefined and fires launchTrack itself whenever the display's state model
  // is not loaded yet, which for every display type in this tree is the first
  // time one is shown
  launchTrack?: (
    trackId: string,
    initialSnapshot?: object,
    displayInitialSnapshot?: Record<string, unknown>,
  ) => Promise<unknown>
  hideTrack?: (trackId: string) => number
}

function viewSelf(view: AbstractViewModel) {
  return view as unknown as ViewSelf
}

// The census helpers over the views' own `ownViews`/`ownTracks`, so this module
// carries no copy of the view nesting: a synteny stack's rows and per-band
// containers, a breakpoint split view's panels, and any depth of nesting all
// arrive through each view declaring what it holds.
function viewTracks(view: AbstractViewModel): TrackSelf[] {
  return view.ownTracks as unknown as TrackSelf[]
}

function allTracks(session: AbstractSessionModel): TrackSelf[] {
  return openTracks(session) as unknown as TrackSelf[]
}

// The drawn display's on-screen state. `displayPhase` is the tree's own
// single-sourced vocabulary (render-core/displayPhase.ts) and the same one
// AppReadyMarker reads; `tooLarge` and `renderError` replace the display
// subtree rather than raising a snackbar, so a settle reporting only
// notifications calls them ready.
function displayState(track: TrackSelf) {
  const display = track.activeDisplay
  if (!display) {
    return {}
  }
  try {
    const phase = display.displayPhase
    return {
      display: display.type,
      // "make it all fit in the window" is a normal thing to be asked, and
      // without this the only way to answer it is measuring DOM rectangles
      ...(typeof display.height === 'number' ? { height: display.height } : {}),
      ...(phase === undefined || phase === 'ready' ? {} : { phase }),
      ...(phase === 'tooLarge' && display.regionTooLargeReason
        ? { reason: display.regionTooLargeReason }
        : {}),
      ...(display.error ? { error: String(display.error) } : {}),
      ...(display.renderError
        ? { renderError: String(display.renderError) }
        : {}),
    }
  } catch (e) {
    return { display: display.type, error: String(e) }
  }
}

// What the session has standing over or beside the views, duck-typed like the
// rest: these getters live on mixins this module must not import.
interface SessionChrome {
  drawerVisible?: boolean
  drawerWidth?: number
  visibleWidget?: { type?: string }
  DialogComponent?: unknown
}

/**
 * The drawer and any modal, for the same reason `offscreen` is reported: both
 * are on top of the views in a screenshot that otherwise looks right.
 *
 * The drawer takes a column off every view rather than covering them, so a
 * figure framed with the track selector open is narrower than the one asked
 * for — which every filmed take worked around by telling the agent in its
 * system prompt to close it. A modal covers the app outright.
 */
function sessionChrome(session: AbstractSessionModel) {
  const s = session as unknown as SessionChrome
  const drawer =
    s.drawerVisible && s.visibleWidget
      ? {
          drawer: {
            widget: s.visibleWidget.type,
            ...(typeof s.drawerWidth === 'number'
              ? { width: s.drawerWidth }
              : {}),
            note: 'the drawer takes this width off every view; session.hideAllWidgets() closes it',
          },
        }
      : {}
  const dialog = s.DialogComponent
    ? {
        dialog: {
          note: 'a modal dialog is open over the app, so a screenshot is of the dialog',
        },
      }
    : {}
  return { ...drawer, ...dialog }
}

export function sessionOf(pluginManager: PluginManager | undefined) {
  return (
    pluginManager?.rootModel as { session?: AbstractSessionModel } | undefined
  )?.session
}

// A view whose init failed (its assembly was never found) paints the error in
// place of a genome and raises no toast, and stays uninitialized: without
// this, a spec with "volvix" for "volvox" settled false with nothing said.
/**
 * Why a view is not finished, or nothing if it is.
 *
 * The three terms are AppReadyMarker's, and they have to be: the marker decides
 * whether the settle ends, this decides what it says when it doesn't, and a
 * term in one and not the other is a settle that answers `false` with an empty
 * `notReady`. `launching` is the one that was missing — `initialized` goes true
 * the moment a linear view's regions land, while the same apply pass still has
 * the spec's tracks to attach, so a spec load timing out there reported no
 * reason at all.
 */
function viewState(v: ViewSelf) {
  if (v.error !== undefined) {
    return { error: String(v.error) }
  }
  if (v.initialized === false) {
    return { phase: 'initializing' }
  }
  return v.pendingLaunch === undefined
    ? {}
    : {
        phase: 'launching',
        reason:
          'the view is still applying what it was launched with (navigation, tracks)',
      }
}

function viewSummary(view: AbstractViewModel): Record<string, unknown> {
  const v = viewSelf(view)
  return {
    id: v.id,
    type: v.type,
    ...viewState(v),
    ...(v.displayName ? { displayName: v.displayName } : {}),
    ...(v.assemblyNames?.length ? { assemblyNames: v.assemblyNames } : {}),
    ...(v.coarseVisibleLocStrings
      ? { visibleRegion: v.coarseVisibleLocStrings }
      : {}),
    // the stack's own height, beside each track's below it: "does this all fit
    // on screen" is then arithmetic rather than three rounds of screenshotting
    ...(typeof v.height === 'number' ? { height: v.height } : {}),
    ...(viewTracks(view).length
      ? {
          tracks: viewTracks(view).map(t => ({
            trackId: t.configuration.trackId,
            trackType: t.type,
            ...displayState(t),
          })),
        }
      : {}),
    ...(view.ownViews.length
      ? { views: view.ownViews.map(sub => viewSummary(sub)) }
      : {}),
  }
}

function sessionSummary(session: AbstractSessionModel) {
  return {
    name: session.name,
    assemblyNames: session.assemblyNames,
    ...sessionChrome(session),
    views: session.views.map(v => viewSummary(v)),
  }
}

// MST nodes serialize as their snapshot (toJSON), so the live-model walk below
// can stringify whatever it lands on; the replacer guards what a snapshot
// cannot contain but a getter's return can.
export function safeJson(value: unknown) {
  // the ANCESTOR chain, not every object seen: MST snapshots are cached and
  // structurally shared, so the same frozen object legitimately appears at two
  // paths, and a visited-set reports the second one as a cycle that is not
  // there. `this` is the holder JSON.stringify is currently walking, which is
  // what lets the chain unwind on the way back up — so this must stay a
  // `function`, not an arrow.
  const chain: unknown[] = []
  // typed by hand: JSON.stringify's declared return is string, but a bare
  // Symbol/undefined at the top level really does yield undefined at runtime
  const json = JSON.stringify(
    isStateTreeNode(value) ? getSnapshot(value) : value,
    function (_key, v: unknown) {
      while (chain.length > 0 && chain.at(-1) !== this) {
        chain.pop()
      }
      if (typeof v === 'function') {
        return '[function]'
      }
      if (typeof v === 'bigint') {
        return `${v}`
      }
      if (v !== null && typeof v === 'object') {
        if (chain.includes(v)) {
          return '[circular]'
        }
        chain.push(v)
      }
      return v
    },
  ) as string | undefined
  return json === undefined ? '"[unserializable]"' : json
}

function describeBrief(value: unknown): string {
  if (Array.isArray(value)) {
    return `array(${value.length})`
  }
  if (value !== null && typeof value === 'object') {
    const json = safeJson(value)
    return json.length > 120 ? `object(~${json.length} bytes)` : json
  }
  const json = safeJson(value)
  return json.length > 120 ? `${json.slice(0, 117)}...` : json
}

// The names a live node answers beyond its snapshot: MST defines views as own
// getter properties on the instance, which is exactly the high-value surface
// (visibleLocStrings, assemblyNames, totalBp, ...) a snapshot filters out.
function memberNames(node: object) {
  const getters: string[] = []
  const methods: string[] = []
  for (const [key, desc] of Object.entries(
    Object.getOwnPropertyDescriptors(node),
  )) {
    if (!key.startsWith('$') && key !== 'toJSON') {
      if (desc.get) {
        getters.push(key)
      } else if (typeof desc.value === 'function') {
        methods.push(key)
      }
    }
  }
  return { getters: getters.sort(), methods: methods.sort() }
}

// The node itself. An agent writing `run_javascript` holds it already —
// jb.view(), session.views[0], track.activeDisplay — so there is nothing to
// learn here. A dot-path string used to be the only way to ask, which had
// agents reconstructing a path to a node in hand, in a grammar ("views.0")
// that is not JavaScript.
function inspectTarget(session: AbstractSessionModel, target: unknown) {
  if (typeof target === 'string') {
    throw new Error(
      `jb.inspect takes the node itself, not the name "${target}" — jb.inspect(jb.view()), jb.inspect(jb.trackModel('someTrackId')), jb.inspect(session.views[0].tracks[0]). Bare jb.inspect() is the session.`,
    )
  }
  return target ?? session
}

function inspectSession(
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  const maxBytes = typeof args.maxBytes === 'number' ? args.maxBytes : 20_000
  const node = inspectTarget(session, args.target)
  const members =
    typeof node === 'object' && !Array.isArray(node)
      ? memberNames(node)
      : { getters: [], methods: [] }
  const json = safeJson(node)
  const base = {
    // the name the docs tool files a type under: docs topic "model:<modelType>"
    ...(isStateTreeNode(node) ? { modelType: getType(node).name } : {}),
    bytes: json.length,
    ...(members.getters.length ? { getters: members.getters } : {}),
    ...(members.methods.length ? { actions: members.methods } : {}),
  }
  if (json.length <= maxBytes) {
    return { ...base, value: JSON.parse(json) as unknown }
  }
  const plain = JSON.parse(json) as unknown
  return Array.isArray(plain)
    ? {
        ...base,
        note: `too large to return whole — ${plain.length} items; inspect one of them or raise maxBytes`,
        items: plain.slice(0, 20).map(item => describeBrief(item)),
      }
    : {
        ...base,
        note: 'too large to return whole — inspect a child of it or raise maxBytes',
        keys: Object.fromEntries(
          Object.entries(plain as Record<string, unknown>).map(([k, v]) => [
            k,
            describeBrief(v),
          ]),
        ),
      }
}

const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

// The readiness contract is AppReadyMarker's, not this file's: it publishes
// data-app-phase from the session (ready = no view resolving an assembly, no
// display fetching), and says so in its own comment.
//
// The hold is why the number is a second: `ready` has to survive past the
// ~600ms FetchVisibleRegions debounce, or one sample taken right after a
// navigation reads the pre-navigation frame as finished. Same reasoning and
// same constant as `waitForAppSettled` in products/jbrowse-capture/src/waits.ts
// (APP_SETTLED_HOLD_MS) — reached independently there, and measured.
const READY_HOLD_MS = 1000

interface SnackbarEntry {
  message: string
  level?: string
}

// An error toast stays up until a human dismisses it, and an info toast leaves
// on its own — so "the last five messages" repeated one stale error in every
// settle result for the rest of a run and named no level for the rest. Each
// toast is delivered to the caller once, by identity: the mobx array keeps the
// object it was pushed as, and removeSnackbarMessage relies on that too.
const deliveredNotifications = new WeakMap<object, WeakSet<object>>()

export function undeliveredNotifications(session: AbstractSessionModel) {
  const entries =
    'snackbarMessages' in session
      ? (session.snackbarMessages as SnackbarEntry[])
      : []
  const known = deliveredNotifications.get(session)
  const delivered = known ?? new WeakSet<object>()
  if (!known) {
    deliveredNotifications.set(session, delivered)
  }
  const fresh = entries.filter(m => !delivered.has(m))
  for (const m of fresh) {
    delivered.add(m)
  }
  return fresh.map(m => ({
    level: m.level ?? 'info',
    message: m.message,
  }))
}

export async function waitReady(
  timeoutMs: number,
  session?: AbstractSessionModel,
  // scoped rather than document-wide because @jbrowse/react-app2 embeds this
  // app in a host page: two mounted apps publish two ready markers, and a
  // document-wide query answers for whichever is first in document order
  root: ParentNode = document,
) {
  const deadline = Date.now() + timeoutMs
  let readySince: number | undefined
  let outcome
  while (outcome === undefined) {
    const ready =
      root.querySelector('[data-app-phase="ready"]') !== null &&
      root.querySelector('[data-testid="loading-overlay"]') === null
    readySince = ready ? (readySince ?? Date.now()) : undefined
    if (readySince !== undefined && Date.now() - readySince >= READY_HOLD_MS) {
      outcome = { settled: true }
    } else if (Date.now() >= deadline) {
      outcome = {
        settled: false,
        note: 'rendering had not settled by the timeout; tracks may still be loading',
      }
    } else {
      await delay(200)
    }
  }
  const messages = session ? undeliveredNotifications(session) : []
  // A display that refuses to draw — over the fetch-size gate, or errored —
  // replaces its own subtree instead of raising a snackbar, so notifications
  // alone report a clean settle over a browser with a blank track in it.
  const notReady = session
    ? [
        ...openViews(session)
          .map(v => ({
            viewId: v.id,
            type: v.type,
            ...viewState(viewSelf(v)),
          }))
          .filter(v => 'phase' in v || 'error' in v),
        ...allTracks(session)
          .map(t => ({ trackId: t.configuration.trackId, ...displayState(t) }))
          .filter(t => 'phase' in t || 'error' in t),
      ]
    : []
  const offscreen = session ? offscreenViews(session, root) : undefined
  return {
    ...outcome,
    ...(messages.length ? { notifications: messages } : {}),
    ...(notReady.length ? { notReady } : {}),
    ...(offscreen ? { offscreen } : {}),
    ...(session ? sessionChrome(session) : {}),
  }
}

// A session taller than the window scrolls, and a screenshot of the viewport
// then shows a plausible browser with the bottom view cut off or the top one
// scrolled away: every filmed take spent turns shrinking tracks after a
// picture, and one found its genome view at y = -267. Reported from the DOM
// the views are laid out in, so the agent knows before it looks.
function offscreenViews(session: AbstractSessionModel, root: ParentNode) {
  const win = root.ownerDocument?.defaultView ?? window
  const windowHeight = win.innerHeight
  const measured = overflow(root)
  const containers = new Map(
    [
      ...root.querySelectorAll<HTMLElement>('[data-testid^="view-container-"]'),
    ].map(el => [el.dataset.testid!.slice('view-container-'.length), el]),
  )
  const views = openViews(session).flatMap(view => {
    const rect = containers.get(view.id)?.getBoundingClientRect()
    return rect && (rect.top < 0 || rect.bottom > windowHeight)
      ? [
          {
            viewId: view.id,
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
          },
        ]
      : []
  })
  return measured.pageHeight > measured.windowHeight || views.length
    ? {
        pageHeight: measured.pageHeight,
        windowHeight: measured.windowHeight,
        scrollY: Math.round(win.scrollY),
        views,
        note: 'the session is taller than the window; a viewport screenshot cuts these views off — await jb.fitToWindow() to shrink what is open until it fits, or screenshot with fullPage: true. A view with a negative top is scrolled out above the viewport (scrollY says by how much), not missing',
      }
    : undefined
}

// Neither app scrolls the document: a column inside the app scrolls, so the
// document's scrollHeight equals the window's height with a view running 700
// px past it. The overflow is the scrolling ancestor's, when one exists.
function scrollerOf(root: ParentNode) {
  const container = root.querySelector('[data-testid^="view-container-"]')
  const win = root.ownerDocument?.defaultView ?? window
  for (let el = container?.parentElement; el; el = el.parentElement) {
    const { overflowY } = win.getComputedStyle(el)
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight
    ) {
      return el
    }
  }
  return undefined
}

// The trailing overscroll ViewStack renders below the last view, which exists so
// a newly-added view can scroll to the middle of the port. It is room, not
// content, and it is up to 300px of a scrollHeight, so a shrink that charges it
// to the views leaves them that much short of the window — the E. coli take's
// dotplot was cut to 312px of the 600 that fit.
function overscrollHeight(scroller: Element) {
  const spacer = scroller.querySelector('[data-testid="view-stack-overscroll"]')
  return spacer ? Math.round(spacer.getBoundingClientRect().height) : 0
}

function overflow(root: ParentNode) {
  const scroller = scrollerOf(root)
  if (scroller) {
    return {
      pageHeight: scroller.scrollHeight - overscrollHeight(scroller),
      windowHeight: scroller.clientHeight,
    }
  }
  const win = root.ownerDocument?.defaultView ?? window
  return {
    pageHeight: win.document.documentElement.scrollHeight,
    windowHeight: win.innerHeight,
  }
}

// What a shrink can leave a display, a synteny band or a dotplot at: enough to
// still read a track's name and see that it drew.
const MIN_HEIGHT_PX = 40

interface Shrinkable {
  what: string
  height: number
  setHeight: (px: number) => void
}

interface HeightSelf {
  id: string
  height?: unknown
  setHeight?: (px: number) => void
  levels?: { height?: unknown; setHeight?: (px: number) => void }[]
}

// Everything on screen whose height is its own state: each shown track's
// display, each synteny band, and a view whose height is a declared property
// rather than the sum of its tracks (a dotplot). A linear view's `height` is a
// getter over its tracks, so shrinking it is shrinking them.
function shrinkables(session: AbstractSessionModel): Shrinkable[] {
  return openViews(session).flatMap(view => {
    const v = view as unknown as HeightSelf
    const declared =
      isStateTreeNode(view) &&
      (getType(view) as { properties?: Record<string, unknown> }).properties
        ?.height !== undefined
    const own: Shrinkable[] =
      declared && typeof v.height === 'number' && v.setHeight
        ? [{ what: `view ${v.id}`, height: v.height, setHeight: v.setHeight }]
        : []
    const bands = (v.levels ?? []).flatMap((level, i) =>
      typeof level.height === 'number' && level.setHeight
        ? [
            {
              what: `view ${v.id} band ${i}`,
              height: level.height,
              setHeight: level.setHeight,
            },
          ]
        : [],
    )
    const displays = viewTracks(view).flatMap(track => {
      const d = track.activeDisplay as
        | (Record<string, unknown> & { setHeight?: (px: number) => void })
        | undefined
      return d && typeof d.height === 'number' && d.setHeight
        ? [
            {
              what: track.configuration.trackId,
              height: d.height,
              setHeight: d.setHeight,
            },
          ]
        : []
    })
    return [...own, ...bands, ...displays]
  })
}

/**
 * Shrink what is open until the session fits the window, and say what moved.
 *
 * Every filmed take spent two to five screenshot rounds on this by hand: the
 * settle reported `offscreen`, the agent guessed which heights to cut and by
 * how much, and looked again. The overflow is arithmetic the settle already
 * does; this spends it across every display, band and dotplot in proportion to
 * the headroom each has above the floor, so tall tracks give up the most and
 * nothing goes below readable.
 */
async function fitToWindow(
  session: AbstractSessionModel,
  settleMs: number,
  root: ParentNode = document,
) {
  const before = overflow(root)
  const excess = before.pageHeight - before.windowHeight
  if (excess <= 0) {
    return { fits: true, ...before }
  }
  const items = shrinkables(session)
  const headroom = items.map(i => Math.max(0, i.height - MIN_HEIGHT_PX))
  const available = headroom.reduce((a, b) => a + b, 0)
  const cut = Math.min(excess, available)
  const shrunk = items.flatMap((item, i) => {
    const share = available ? Math.round((cut * headroom[i]!) / available) : 0
    if (share <= 0) {
      return []
    }
    const to = item.height - share
    item.setHeight(to)
    return [{ what: item.what, from: item.height, to }]
  })
  const settle = await waitReady(settleMs, session, root)
  const after = overflow(root)
  const left = after.pageHeight - after.windowHeight
  return {
    fits: left <= 0,
    overflowBefore: excess,
    overflowAfter: Math.max(0, left),
    shrunk,
    ...(left > 0
      ? {
          note:
            available < excess
              ? `everything shrinkable is at its ${MIN_HEIGHT_PX} px floor — hide a track or a view, or screenshot with fullPage: true`
              : 'still taller than the window after the settle — call jb.fitToWindow() again',
        }
      : {}),
    ...settle,
  }
}

// The catalog is the largest result of nearly every agent run — the 129 volvox
// rows were 20 KB — so a row carries what picks a track out of the list and
// nothing more. The adapter type is `jb.inspect`'s or `jb.describeSlots`' to
// answer for the one track an agent went on to use.
//
// Dropping assemblyNames wherever the session has a single assembly saved
// nothing and made the row shape vary by session: a config declares far more
// assemblies than it opens, and volvox — every eval run's config — declares 10.
function trackEntry(conf: BaseTrackConfig) {
  return {
    trackId: conf.trackId,
    name: readConfObject(conf, 'name'),
    type: conf.type,
    // getConfAssemblyNamesOrNone, not the slot: an assembly's sequence track
    // has no assemblyNames slot and answers through its parent assembly
    assemblyNames: getConfAssemblyNamesOrNone(conf),
  }
}

// Each assembly's own sequence track, which no track list holds: the config
// keeps it under the assembly as `sequence`, so `jb.getFeatures` on its
// trackId reads bases while `listTracks` never named it.
function sequenceTracks(session: AbstractSessionModel) {
  return session.assemblyManager.assemblyList.map(asm => asm.sequence)
}

function listTracks(
  session: AbstractSessionModel,
  searchArg?: string,
  limitArg?: number,
) {
  const search = searchArg?.toLowerCase() ?? ''
  const limit = limitArg ?? 100
  // allSessionTracks, not session.tracks: connection-supplied tracks (hubs,
  // registries) are absent from the session lists but fully showable — a
  // hand-rolled union here hid them from agents entirely
  const matches = [...allSessionTracks(session), ...sequenceTracks(session)]
    .map(c => trackEntry(c))
    .filter(
      t =>
        !search ||
        t.trackId.toLowerCase().includes(search) ||
        t.name.toLowerCase().includes(search),
    )
  return {
    total: matches.length,
    ...(matches.length > limit
      ? { note: `showing ${limit} of ${matches.length}; refine with search` }
      : {}),
    tracks: matches.slice(0, limit),
  }
}

function pickView(
  session: AbstractSessionModel,
  args: Record<string, unknown>,
  capability: 'navToLocString' | 'showTrack' | 'launchTrack' | 'hideTrack',
  wants?: {
    assembly?: string
    trackType?: string
    pluginManager?: PluginManager
  },
) {
  const viewId = typeof args.viewId === 'string' ? args.viewId : undefined
  const candidates = viewScope(session, viewId)
  const able = candidates.filter(
    v => typeof viewSelf(v)[capability] === 'function',
  )
  if (!able.length) {
    throw new Error(
      `No ${inScope(viewId)} supports this (${candidates.map(v => v.type).join(', ') || 'none open'}) — jb.loadSessionSpec can open one.`,
    )
  }
  // A view on another assembly would show the track and render nothing, with a
  // successful-looking result — the same silent mismatch visibleRegionsOf
  // guards against for reads
  const onAssembly = wants?.assembly
    ? able.filter(v =>
        viewSelf(v).assemblyNames?.some(name =>
          isSameAssemblyName(name, wants.assembly, session.assemblyManager),
        ),
      )
    : able
  if (!onAssembly.length) {
    throw new Error(
      `No open view is on assembly "${wants!.assembly}" (open views: ${able.map(v => `${v.id} on ${viewSelf(v).assemblyNames?.join(', ')}`).join('; ')}) — open one, or pass show: false`,
    )
  }
  const canDisplay =
    wants?.trackType && wants.pluginManager
      ? onAssembly.filter(v =>
          viewCanDisplayTrack(
            wants.pluginManager!,
            viewDisplayNames(wants.pluginManager!, v.type),
            wants.trackType!,
          ),
        )
      : onAssembly
  if (!canDisplay.length) {
    throw new Error(
      `No open view can display a ${wants!.trackType} (open views: ${onAssembly.map(v => v.type).join(', ')})`,
    )
  }
  return onlyView(session, canDisplay, 'could take this', viewId)
}

// A synteny view's rows count as open views (they are what shows a region and
// a track), and an agent looking at one synteny view read "3 views are open"
// with nothing saying two of them were its rows.
function parentView(session: AbstractSessionModel, view: AbstractViewModel) {
  return openViews(session).find(v => v.ownViews.includes(view))
}

function describeView(session: AbstractSessionModel, view: AbstractViewModel) {
  const v = viewSelf(view)
  const on = v.assemblyNames?.length ? ` on ${v.assemblyNames.join(', ')}` : ''
  const at = v.coarseVisibleLocStrings ? ` at ${v.coarseVisibleLocStrings}` : ''
  const parent = parentView(session, view)
  const row = parent ? `, a row of ${parent.id}` : ''
  return `${v.id} (${v.type}${on}${at}${row})`
}

function onlyView(
  session: AbstractSessionModel,
  candidates: AbstractViewModel[],
  relation: string,
  viewId?: string,
) {
  const named = candidates.find(v => v.id === viewId)
  if (named) {
    return named
  }
  const [first, ...rest] = candidates
  if (!first) {
    throw new Error('No open view')
  }
  if (rest.length) {
    throw new Error(
      `${candidates.length} views ${relation}: ${candidates.map(v => describeView(session, v)).join('; ')} — pass viewId to say which`,
    )
  }
  return first
}

function viewById(session: AbstractSessionModel, viewId?: string) {
  const candidates = openViews(session)
  if (viewId !== undefined) {
    const named = candidates.find(v => v.id === viewId)
    if (!named) {
      throw new Error(
        `No view with id "${viewId}". Open views: ${candidates.map(v => describeView(session, v)).join('; ') || 'none'}`,
      )
    }
    return named
  }
  if (!candidates.length) {
    throw new Error('No view is open — jb.loadSessionSpec can open one')
  }
  return onlyView(session, candidates, 'are open')
}

function inScope(viewId?: string) {
  return viewId === undefined ? 'open view' : `view in ${viewId}`
}

function viewScope(session: AbstractSessionModel, viewId?: string) {
  return viewId === undefined
    ? openViews(session)
    : viewAndNested(viewById(session, viewId))
}

interface JbRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
}

function shownTrackModel(
  session: AbstractSessionModel,
  trackId: string,
  viewId?: string,
) {
  const trackOf = (v: AbstractViewModel) =>
    viewTracks(v).find(t => t.configuration.trackId === trackId)
  const showing = viewScope(session, viewId).filter(v => trackOf(v))
  // undefined here was followed by ".activeDisplay" on the next line of every
  // agent's code, and a TypeError says nothing about which of the two causes
  // it was
  if (!showing.length) {
    throw new Error(
      session.getTrackById(trackId)
        ? `"${trackId}" is not shown in any ${inScope(viewId)} — await view.launchTrack("${trackId}") first; jb.sessionSummary() lists what each view shows`
        : `No track with trackId "${trackId}" — jb.listTracks() shows what is available`,
    )
  }
  return trackOf(onlyView(session, showing, `show "${trackId}"`, viewId))!
}

/**
 * One place, as `loc` takes it: a locstring, or the object shape every other
 * region on this surface has — `jb.visibleRegions`' answer, a feature's own
 * coordinates — which used to reach `parseLocString` and die there with
 * "endsWith is not a function". Several places are `regions`.
 */
export type JbLoc =
  | string
  | { refName: string; start?: number; end?: number; assemblyName?: string }

function isRegionLoc(loc: unknown): loc is Exclude<JbLoc, string> {
  return (
    !!loc &&
    typeof loc === 'object' &&
    typeof (loc as { refName?: unknown }).refName === 'string'
  )
}

async function trackAssembly(
  session: AbstractSessionModel,
  conf: AnyConfigurationModel,
  requested: string | undefined,
) {
  // getConfAssemblyNamesOrNone, not the assemblyNames slot: an assembly's own
  // sequence track has no such slot and answers through its parent assembly
  const trackAssemblies = getConfAssemblyNamesOrNone(conf)
  const assemblyName = requested ?? trackAssemblies[0]
  if (assemblyName === undefined) {
    throw new Error('The track names no assembly; pass assembly explicitly')
  }
  // a named assembly the track is not on renames the region against the wrong
  // alias set and answers with the wrong assembly's coordinates, or nothing
  if (
    requested !== undefined &&
    trackAssemblies.length &&
    !trackAssemblies.some(name =>
      isSameAssemblyName(name, requested, session.assemblyManager),
    )
  ) {
    throw new Error(
      `Track "${conf.trackId}" is on ${trackAssemblies.join(', ')}, not "${requested}"`,
    )
  }
  const assembly = await session.assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    throw new Error(`Assembly "${assemblyName}" could not be loaded`)
  }
  return { assembly, assemblyName }
}

async function locToRegion(
  session: AbstractSessionModel,
  conf: AnyConfigurationModel,
  loc: unknown,
  assemblyArg: string | undefined,
): Promise<JbRegion> {
  if (typeof loc !== 'string' && !isRegionLoc(loc)) {
    throw new Error(
      `jb.getFeatures takes loc as ONE place — a locstring ("ctgA:1-100") or a region object ({ refName, start, end }) — and got ${JSON.stringify(loc)}${Array.isArray(loc) ? '; several regions go in regions: [...]' : ''}`,
    )
  }
  const { assembly, assemblyName } = await trackAssembly(
    session,
    conf,
    assemblyArg ?? (typeof loc === 'string' ? undefined : loc.assemblyName),
  )
  const parsed =
    typeof loc === 'string'
      ? parseLocString(loc, refName => assembly.isValidRefName(refName))
      : loc
  const refName = assembly.getCanonicalRefName(parsed.refName) ?? parsed.refName
  // parseLocString asks this for the string form. A region object skipping it
  // read empty on a name the assembly does not have, which is the answer this
  // surface exists to turn into an error.
  if (!assembly.isValidRefName(refName)) {
    throw new Error(
      `"${parsed.refName}" is not a sequence in ${assemblyName} — jb.visibleRegions() and jb.sessionSummary() name what is there`,
    )
  }
  const bounds = assembly.regions?.find(r => r.refName === refName)
  return {
    assemblyName,
    refName,
    start: parsed.start ?? bounds?.start ?? 0,
    end: parsed.end ?? bounds?.end ?? Number.MAX_SAFE_INTEGER,
  }
}

async function visibleRegionsOf(
  session: AbstractSessionModel,
  viewId: string | undefined,
  preferTrackId?: string,
  trackAssemblies: string[] = [],
): Promise<JbRegion[]> {
  // `in`, not evaluation: visibleRegions is a getter that THROWS ("width
  // undefined") until the view's component mounts and sets a width — a
  // freshly spec-loaded view stays in that state briefly even after the
  // app-phase marker reads ready, since a view with no width has no display
  // fetching anything.
  const regionBearing = viewScope(session, viewId).filter(
    v => 'visibleRegions' in v,
  )
  if (!regionBearing.length) {
    throw new Error(
      `No ${inScope(viewId)} shows a region — pass loc, or open a linear view`,
    )
  }
  // a view on another assembly than the track would hand its region to a file
  // that has no such sequence, which answers nothing, silently
  const candidates = trackAssemblies.length
    ? regionBearing.filter(
        v =>
          !viewSelf(v).assemblyNames?.length ||
          viewSelf(v).assemblyNames!.some(name =>
            trackAssemblies.some(t =>
              isSameAssemblyName(name, t, session.assemblyManager),
            ),
          ),
      )
    : regionBearing
  if (!candidates.length) {
    throw new Error(
      `No open view is on ${trackAssemblies.join(', ')} (open views: ${regionBearing.map(v => describeView(session, v)).join('; ')}) — pass loc, or open a view on that assembly`,
    )
  }
  // among region-bearing views, the ones actually showing the track — two
  // views on two assemblies would otherwise send the first view's namespace to
  // the second view's file, which answers nothing, silently
  const showing = candidates.filter(v =>
    viewTracks(v).some(t => t.configuration.trackId === preferTrackId),
  )
  const chosen = onlyView(
    session,
    showing.length ? showing : candidates,
    showing.length ? `show "${preferTrackId}"` : 'show a region',
    viewId,
  )
  const view = viewSelf(chosen)
  const deadline = Date.now() + 10_000
  let visible: NonNullable<ViewSelf['visibleRegions']> | undefined
  while (visible === undefined) {
    if (view.error !== undefined) {
      throw new Error(
        `View ${view.id} failed to initialize: ${String(view.error)} — pass loc with assembly, or open a view that loads`,
      )
    }
    if (view.initialized !== false) {
      try {
        visible = view.visibleRegions
      } catch {
        // not mounted yet
      }
    }
    if (visible?.length) {
      break
    }
    visible = undefined
    if (Date.now() >= deadline) {
      throw new Error(
        'The view has not finished initializing a visible region — pass loc, or navigate first',
      )
    }
    await delay(250)
  }
  // whole bases: a block edge is a fractional bp, and 30000.000000000004
  // reads as a bug in every answer that echoes it
  return visible.map(({ refName, start, end, assemblyName }) => ({
    refName,
    start: Math.floor(start),
    end: Math.ceil(end),
    assemblyName,
  }))
}

// The same RPCs the track's display issues, on the same worker: the sessionId
// is `adapterConfigCacheKey` of the adapter config, which is exactly what
// `BaseTrackModel.rpcSessionId` derives, so a shown track's parsed index and
// chunk cache are reused rather than rebuilt in a main-thread twin that nothing
// ever freed. Retained and released like a track does, so an un-shown track's
// worker cache is dropped once this read is done. Regions are renamed to the
// file's own refNames during serialization (RpcMethodTypeWithRenameRegions),
// and the features come back rebuilt as SimpleFeature. What crosses the worker
// boundary is bounded by the byte gate that runs first.
async function fetchFeatures(
  session: AbstractSessionModel,
  trackId: string,
  regions: JbRegion[],
  requestedByteLimit?: number,
) {
  const conf = session.getTrackById(trackId)
  if (!conf) {
    throw new Error(
      `No track with trackId "${trackId}" — jb.listTracks() shows what is available`,
    )
  }
  const adapterConfig = readConfObject(conf, 'adapter')
  const sessionId = adapterConfigCacheKey(adapterConfig)
  // The adapter's own declared limit where it has one, so this does not quietly
  // disagree with the size the track's display already refuses to render —
  // the reasoning BaseTrackModel.exportByteLimit spells out for "Save track
  // data", which is the other path that fetches because someone asked rather
  // than because a view scrolled.
  const byteLimit = agentByteLimit(
    readConfObject(conf, ['adapter', 'fetchSizeLimit']),
    requestedByteLimit,
  )
  const { rpcManager } = session
  const controller = new AbortController()
  const { signal } = controller
  // desktop's MCP relay gives up at 150s, so the read must not outlive it —
  // and an agent-triggered read of a dense region wants a ceiling either way
  const stopTimer = setTimeout(() => {
    controller.abort()
  }, 120_000)
  retainAdapterSession(rpcManager, sessionId)
  try {
    // The agent's "region too large". A display refuses to fetch over its own
    // gate and paints the reason; this path has no display, so without the
    // same question asked here an agent that names a whole chromosome pulls it
    // — over someone else's data host, into the page it is about to
    // screenshot. Same index-only estimate the gated RPC takes first, and a
    // refusal rather than a truncation: a short answer that looked like the
    // whole answer is the failure this surface exists to prevent.
    const bytes = await rpcManager.call(
      sessionId,
      'CoreGetRegionByteEstimate',
      // eslint-disable-next-line no-restricted-syntax -- reports nothing: an agent awaits the returned features and no display or dialog exists to show a phase label or bar
      { adapterConfig, regions, scope: 'largestRegion', signal },
    )
    if (bytes !== undefined && bytes > byteLimit) {
      throw new Error(
        `region too large for jb.getFeatures: the largest region is ~${bytes} bytes against a limit of ${byteLimit}. Narrow the region, or pass an explicit byteLimit if you mean to pull this much.`,
      )
    }
    // eslint-disable-next-line no-restricted-syntax -- reports nothing: see the estimate above
    return await rpcManager.call(sessionId, 'CoreGetFeatures', {
      adapterConfig,
      regions,
      signal,
    })
  } finally {
    clearTimeout(stopTimer)
    void releaseAdapterSession(rpcManager, sessionId)
  }
}

// A LocalPathLocation only reads under Electron: in a browser openLocation
// throws "can't use local files in the browser" at the FIRST READ, not here, so
// accepting one would report a track added and then fail inside the display
// where the agent is least likely to connect it to what it asked for.
const URL_TEXT = /^https?:\/\//
const ABSOLUTE_PATH = /^(?:\/|[a-zA-Z]:[\\/]|\\\\)/

function isFileLocationText(spec: string) {
  return URL_TEXT.test(spec) || ABSOLUTE_PATH.test(spec)
}

function fileLocation(spec: string): FileLocation {
  if (URL_TEXT.test(spec)) {
    return { uri: spec, locationType: 'UriLocation' }
  }
  // The app's working directory is not the agent's, and a relative path
  // resolves against the app's: under a packaged app that is "/", so the read
  // fails at the first fetch and reports through the display, not here.
  if (!ABSOLUTE_PATH.test(spec)) {
    throw new Error(
      `jb.addTrack needs an absolute local path or a URL: "${spec}" is relative and would resolve against the app's working directory, not yours.`,
    )
  }
  if (!isElectron) {
    throw new Error(
      `jb.addTrack needs a URL in a browser, and "${spec}" is a local path. JBrowse Web cannot read local files except through the Add track file picker, which needs a real file chosen by hand.`,
    )
  }
  return { localPath: spec, locationType: 'LocalPathLocation' }
}

// A stacked set of bigWigs is one track over a MultiWiggleAdapter, which the
// per-file guesser cannot express — the web take hand-wrote the config. The
// subadapters form rather than the `bigWigs` shorthand: that one takes
// absolute URLs only, and desktop's locations are paths.
// the file's name without its bigWig extension, or undefined for any other file
function bigWigStem(location: string) {
  const fileName = location.split(/[/\\]/).pop() ?? location
  const match = /^(.+)\.(bw|bigwig)$/i.exec(fileName)
  return match?.[1]
}

function multiWiggleTrackConf(locations: string[], assemblyName: string) {
  const stems = locations.map(l => bigWigStem(l))
  const notBigWig = locations.filter((_, i) => stems[i] === undefined)
  if (notBigWig.length) {
    throw new Error(
      `jb.addTrack takes a list of locations only for bigWigs (one stacked MultiQuantitativeTrack); not bigWig: ${notBigWig.join(', ')}. Add other formats one at a time.`,
    )
  }
  const adapter = {
    type: 'MultiWiggleAdapter',
    subadapters: locations.map((l, i) => ({
      type: 'BigWigAdapter',
      name: stems[i],
      bigWigLocation: fileLocation(l),
    })),
  }
  return {
    trackId: `multiwiggle-${objectHash(adapter).slice(0, 8)}`,
    type: 'MultiQuantitativeTrack',
    name: stems.join(', '),
    assemblyNames: [assemblyName],
    adapter,
  }
}

// one location, a list of them, or nothing usable
function locationsOf(value: unknown) {
  return Array.isArray(value)
    ? value.filter((l): l is string => typeof l === 'string')
    : typeof value === 'string'
      ? value
      : ''
}

interface SlotDescription {
  type: string
  description?: string
  defaultValue?: unknown
  /** a nested object's own slots, and the slot its string shorthand lifts into */
  slots?: Record<string, SlotDescription>
  shorthand?: string
}

// Vocabulary introspection: every config slot a live config node's schema
// defines, so code never has to guess which settings keys exist — an unknown
// key is not an error, only an entry in applyDisplaySettings' `unapplied` list.
// A nested object (`facet`, `color`) lists its own slots, and the slot its
// string shorthand lifts into.
function describeSlots(
  conf: AnyConfigurationModel,
): Record<string, SlotDescription> {
  const definition = getConfigurationSchemaDefinition(conf) ?? {}
  return Object.fromEntries(
    Object.entries(definition).flatMap(
      ([name, def]): [string, SlotDescription][] => {
        if (isSlotDefinitionEntry(def)) {
          return [
            [
              name,
              {
                type: def.type,
                ...(def.description ? { description: def.description } : {}),
                defaultValue: def.defaultValue,
              },
            ],
          ]
        }
        if (isConfigurationSubschema(conf, name)) {
          const node = conf[name] as AnyConfigurationModel
          const shorthand = getConfigurationSchemaOptions(node)?.shorthand
          return [
            [
              name,
              {
                type: mst
                  .getType(node)
                  .name.replace(/ConfigurationSchema$/, ''),
                slots: describeSlots(node),
                ...(shorthand ? { shorthand } : {}),
              },
            ],
          ]
        }
        return []
      },
    ),
  )
}

// The raw primitive under all of the above: Claude-authored code against the
// live model graph. The renderer already runs with nodeIntegration and the
// bridge socket is user-only, so this grants what the surface as a whole
// already grants — expressed directly instead of through a curated verb.
// The re-export registry is what pluginManager.jbrequire serves, the modules
// external plugins link against. It stays empty until a runtime plugin loads,
// and a loaded plugin fills it with the product's map, which serves every
// bundled @jbrowse package rather than core alone — so this fills only an
// empty registry.
export async function ensureReExports() {
  if (Object.keys(getReExportRegistry()).length === 0) {
    setReExportRegistry(
      (await import('@jbrowse/core/ReExports/modules')).default,
    )
  }
}

// The front door for an agent that just found `jb` and knows nothing else —
// jbrowse-web's console banner and meta tag point here, because a browser
// agent has no MCP docs tool and no initialize instructions to learn the
// contract from.
const JB_HELP = `jb drives this JBrowse app programmatically (window.jb in a browser; the same object is the "jb" argument of JBrowse Desktop's run_javascript MCP tool).

Orient first: jb.sessionSummary(). Introspect, never guess: jb.listTracks(search?, limit?) answers { total, tracks } with the trackIds; jb.describeSlots(jb.trackModel('someTrackId').activeDisplay.configuration) for the settings keys a display accepts — an unknown settings key is not an error, it lands in applyDisplaySettings' "unapplied" list as { key, reason }, so read the report; jb.inspect(node) — jb.view(), jb.trackModel('someTrackId'), session.views[0] — for its getters, actions and modelType.

The model is mobx-state-tree: mutate only through actions (raw assignment throws), and write display settings with track.applyDisplaySettings(settings). A feature or variant track groups and colors through two settings, track.applyDisplaySettings({ facet: 'strand' or { field, domain? }, color: a CSS color or { field: 'type', domain?, palette? } }), where null resets any setting; it filters with activeDisplay.setJexlFilters([jexl]). An alignments track takes the same facet, its field a read dimension ('pairOrientation', 'mapq', ...) or a tag ('tags.HP'). Build views declaratively with jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly, loc, tracks: [...] }] }), which replaces the session; jb.addView(oneViewSpec) opens one more view beside what is open; jb.setSession(document) rewrites the session as a document — what jb.mst.getSnapshot(jb.session) answers, edited: a view keeps its id and is patched in place, loc on it navigates, a { trackId } entry in its tracks opens that track. Act on a view with await view.navToLocString('BRCA1' or 'chr1:1-1000'), which also SHOWS the track whose search index answered a gene name unless a 4th arg { showHitTrack: false } says not to; await view.launchTrack(trackId, {}, settings) shows a track with settings, view.hideTrack(trackId) hides it. Arrange open views into panels with session.layoutViews({ direction: 'horizontal', children: [{ views: [viewId] }, ...] }), a leaf naming view ids or session.views indexes; await jb.fitToWindow() shrinks what is open until the session fits the window; add data with jb.addTrack({ location }) (an absolute path or a URL), or show a track the catalog already holds with jb.addTrack({ trackId, settings? }); read data with await jb.getFeatures({ trackId, loc?, assembly?, viewId?, regions?, byteLimit? }), which renames refNames ("chr1" vs "1") so the file answers and reads on the worker the track's display uses. Anything lower level is jb.require('@jbrowse/core/util') and friends, the module registry plugins link against. After changing anything, await jb.waitReady(ms) and read its notifications and notReady lists before trusting the screen.

Views nest and several can be open. jb.view(viewId?) is the open view, and jb.view(), jb.trackModel(trackId), jb.visibleRegions(), jb.addTrack and jb.getFeatures over a visible region throw naming the candidates rather than picking one when more than one view could answer — pass viewId (from jb.sessionSummary()) to say which. A synteny or breakpoint view's viewId also covers its rows: the named view answers when it can, and otherwise its rows do.

Full guide: https://jbrowse.org/jb2/docs/agents_live_model (offline in JBrowse Desktop's MCP docs tool).`

export interface JbApiOptions {
  /**
   * Told about every notification a settle inside this object consumed.
   *
   * A toast is delivered to a caller once, by identity, so a settle is a
   * CONSUMER: `await jb.waitReady(...)` followed by `return 'ok'` used to drop
   * whatever fired during the call, while the MCP envelope goes on promising
   * that every result carries the session's notifications. Desktop passes a
   * sink and merges what it collects into the envelope; jbrowse-web passes
   * none, because in a browser the settle result IS where an agent reads them.
   */
  onNotifications?: (
    notifications: { level: string; message: string }[],
  ) => void
}

// The helper library an agent drives the app through. Built from the plugin
// manager alone, so one of these serves a whole app rather than one session —
// which is what lets jbrowse-web hand the same object to every caller for the
// life of a plugin manager.
export function createJbApi(
  pluginManager: PluginManager,
  options: JbApiOptions = {},
) {
  // Resolved per call, never captured: jb.loadSessionSpec REPLACES the session,
  // and a helper bound to the old one keeps answering from a detached tree —
  // which reads as stale data rather than throwing, so the agent is told about
  // a session that no longer exists. `jb.session` is how code re-reads it after
  // a spec load.
  const live = () => {
    const current = sessionOf(pluginManager)
    if (!current) {
      throw new Error(
        'No session is open, so there is nothing for this helper to read. Build one with jb.loadSessionSpec({ views: [...] }), which needs no session of its own, or load a config with the open tool.',
      )
    }
    return current
  }
  // Every settle an agent can reach goes through here, so a notification
  // cannot be consumed by one of these helpers without the caller hearing
  // about it.
  // a declaration, not a generic arrow: `<T>(x: T) => …` in a .ts file is a
  // JSX tag to babel, which is what jest parses these with
  function reported<T>(settle: T) {
    const messages = (settle as { notifications?: unknown }).notifications
    if (Array.isArray(messages) && messages.length > 0) {
      options.onNotifications?.(
        messages as { level: string; message: string }[],
      )
    }
    return settle
  }
  const jb = {
    help: JB_HELP,
    get session() {
      return live()
    },
    get rootModel() {
      return pluginManager.rootModel
    },
    require: pluginManager.jbrequire,
    ensureRequire: ensureReExports,
    mst,
    mobx,
    readConfObject,
    getConf,
    describeSlots,
    // a default because an omitted number made the deadline NaN, and a view
    // that never readied then held the call open to the relay's own timeout
    waitReady: async (timeoutMs = 30_000) =>
      reported(await waitReady(timeoutMs, live())),
    sessionSummary: () => sessionSummary(live()),
    inspect: (target?: unknown, maxInspectBytes?: number) =>
      inspectSession(live(), { target, maxBytes: maxInspectBytes }),
    listTracks: (search?: string, limit?: number) =>
      listTracks(live(), search, limit),
    view: (viewId?: string) => viewById(live(), viewId),
    trackModel: (trackId: string, viewId?: string) =>
      shownTrackModel(live(), trackId, viewId),
    visibleRegions: (viewId?: string) => visibleRegionsOf(live(), viewId),
    loadSessionSpec: async (spec: Record<string, unknown>, settleMs?: number) =>
      reported(await loadSpec(pluginManager, { spec, settleMs })),
    addView: async (spec: ViewSpec, settleMs = SPEC_SETTLE_DEFAULT_MS) =>
      reported(await addView(pluginManager, live(), spec, settleMs)),
    setSession: async (
      document: Record<string, unknown>,
      settleMs = SPEC_SETTLE_DEFAULT_MS,
    ) => reported(await setSession(pluginManager, live(), document, settleMs)),
    fitToWindow: async (settleMs = 30_000) =>
      reported(await fitToWindow(live(), settleMs)),
    addTrack: (opts: {
      // a file to add to the catalog and show, or the trackId of one the
      // catalog already holds, to show it
      location?: string | string[]
      trackId?: string
      index?: string
      assembly?: string
      name?: string
      settings?: Record<string, unknown>
      show?: boolean
      viewId?: string
      settleMs?: number
    }) => addTrack(pluginManager, live(), opts).then(reported),
    // Two of four filmed takes wrote jb.getFeatures('trackId', loc) and lost a
    // turn to "No track with trackId undefined", and a third wrote
    // jb.getFeatures('trackId', loc, { assembly }) and had the options
    // silently ignored — so the positional form is accepted alongside the
    // object it was documented as, options third.
    getFeatures: async (
      args:
        | string
        | {
            trackId: string
            // one place: a locstring or a region object
            loc?: JbLoc
            assembly?: string
            // each entry as `loc` takes one: locToRegion fills the assembly
            regions?: Exclude<JbLoc, string>[]
            viewId?: string
            // raises the region-too-large refusal for a read you mean to be big
            byteLimit?: number
          },
      positionalLoc?: JbLoc,
      positionalOpts?: {
        assembly?: string
        viewId?: string
        byteLimit?: number
      },
    ) => {
      const fetchArgs =
        typeof args === 'string'
          ? { trackId: args, loc: positionalLoc, ...positionalOpts }
          : args
      const session = live()
      const conf = session.getTrackById(fetchArgs.trackId)
      if (!conf) {
        throw new Error(
          `No track with trackId "${fetchArgs.trackId}" — jb.listTracks() shows what is available`,
        )
      }
      // `regions` entries go through locToRegion as `loc` does. Passed
      // straight to the fetch they skipped the canonical rename, and an entry
      // carrying no assemblyName reached renameRegionsIfNeeded with nothing to
      // rename against — an alias spelling then read empty and said nothing.
      const regions = fetchArgs.regions
        ? await Promise.all(
            fetchArgs.regions.map(region =>
              locToRegion(session, conf, region, fetchArgs.assembly),
            ),
          )
        : fetchArgs.loc !== undefined
          ? [
              await locToRegion(
                session,
                conf,
                fetchArgs.loc,
                fetchArgs.assembly,
              ),
            ]
          : await visibleRegionsOf(
              session,
              fetchArgs.viewId,
              fetchArgs.trackId,
              getConfAssemblyNamesOrNone(conf),
            )
      return fetchFeatures(
        session,
        fetchArgs.trackId,
        regions,
        fetchArgs.byteLimit,
      )
    },
  }
  return jb
}

export type JbApi = ReturnType<typeof createJbApi>

// a spec load on a busy machine passed 30s and answered settled:false over
// views that were fine; the wait exits the moment they are ready
const ADD_TRACK_SETTLE_MS = 60_000

function namesAFile(value: unknown) {
  return Array.isArray(value)
    ? value.some(l => typeof l === 'string' && isFileLocationText(l))
    : typeof value === 'string' && isFileLocationText(value)
}

// The name an agent meant as a catalog trackId: `trackId`, or a `location`
// that is neither a URL nor a path. Agent runs reached for jb.addTrack to SHOW
// a track already in the catalog in both spellings, and each paid a round trip
// for a refusal that only named another helper.
//
// A location that names a file is the file route whatever else came with it:
// `trackId` beside `location` is how a track CONFIG spells this, and taking it
// as the catalog route would refuse the file the caller asked to add.
function catalogName(args: Record<string, unknown>) {
  if (namesAFile(args.location)) {
    return undefined
  }
  if (typeof args.trackId === 'string') {
    return args.trackId
  }
  return typeof args.location === 'string' ? args.location : undefined
}

async function addTrack(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  const named = catalogName(args)
  const inCatalog =
    named === undefined ? undefined : session.getTrackById(named)
  // before the add-rights check: showing a track the catalog already holds
  // adds nothing to it
  if (inCatalog) {
    return showCatalogTrack(pluginManager, session, inCatalog, args)
  }
  if (named !== undefined && typeof args.trackId === 'string') {
    throw new Error(
      `No track with trackId "${args.trackId}" — jb.listTracks() shows what the catalog holds, and jb.addTrack({ location }) adds a file to it.`,
    )
  }
  if (!isSessionWithAddSessionTrack(session)) {
    throw new Error('This session cannot add tracks')
  }
  const location = locationsOf(args.location)
  if (!location.length) {
    throw new Error(
      'jb.addTrack needs a location (an absolute local path or a URL) to add a file, or the trackId of a track already in the catalog to show it — jb.listTracks() lists those.',
    )
  }
  const requested =
    typeof args.assembly === 'string' ? args.assembly : session.assemblyNames[0]
  if (requested === undefined) {
    throw new Error('The session has no assemblies to attach the track to')
  }
  // resolved to the session's own spelling: an alias ("vvx" for "volvox",
  // "GRCh38" for "hg38") names the assembly and would otherwise be refused
  const assembly = session.assemblyNames.find(name =>
    isSameAssemblyName(name, requested, session.assemblyManager),
  )
  if (assembly === undefined) {
    throw new Error(
      `Assembly "${requested}" is not in this session (has: ${session.assemblyNames.join(', ')})`,
    )
  }
  const conf = Array.isArray(location)
    ? multiWiggleTrackConf(location, assembly)
    : guessTrackConfForLocation(
        fileLocation(location),
        typeof args.index === 'string' ? fileLocation(args.index) : undefined,
        pluginManager,
        assembly,
      )
  session.addSessionTrackConf({
    ...conf,
    ...(typeof args.name === 'string' ? { name: args.name } : {}),
  })
  const summary = {
    trackId: conf.trackId,
    trackType: conf.type,
    adapterType: conf.adapter.type,
    assembly,
  }
  return args.show === false
    ? summary
    : {
        ...summary,
        ...(await showTrack(
          pluginManager,
          session,
          { trackId: conf.trackId, trackType: conf.type, assembly },
          args,
        )),
      }
}

// A track already in the catalog, shown: the same view choice and the same
// settle the file route ends in.
// `conf` is whatever `session.getTrackById` answered, which is a track config
// but not necessarily a `BaseTrackConfig` — an assembly's ReferenceSequenceTrack
// declares a subset of those slots. The four reads below are all ones it has.
async function showCatalogTrack(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  conf: AnyConfigurationModel,
  args: Record<string, unknown>,
) {
  // index, assembly and name describe the file being added, and the catalog's
  // copy already has all three — taking them here would drop them in silence
  const fileArgs = ['index', 'assembly', 'name'].filter(
    key => args[key] !== undefined,
  )
  if (fileArgs.length) {
    throw new Error(
      `"${conf.trackId}" is in the catalog already, so ${fileArgs.join(' and ')} would be ignored — drop ${fileArgs.length > 1 ? 'them' : 'it'}, or pass a location to add a new file.`,
    )
  }
  const track = {
    trackId: conf.trackId,
    trackType: conf.type,
    assembly: getConfAssemblyNamesOrNone(conf)[0],
  }
  const adapterType = readConfObject(conf, ['adapter', 'type']) as
    | string
    | undefined
  const summary = { ...track, ...(adapterType ? { adapterType } : {}) }
  // show:false over a catalog trackId asks for nothing — there is no file to
  // add — and showing it anyway would contradict the flag
  return args.show === false
    ? summary
    : {
        ...summary,
        ...(await showTrack(pluginManager, session, track, args)),
      }
}

function isSettings(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

async function showTrack(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  track: { trackId: string; trackType: string; assembly?: string },
  args: Record<string, unknown>,
) {
  const view = pickView(session, args, 'launchTrack', {
    assembly: track.assembly,
    trackType: track.trackType,
    pluginManager,
  })
  // awaited: a display state model is lazy in every plugin here, and the
  // synchronous showTrack answers before the chunk lands — so the settle below
  // would run against a session that does not hold the track yet, and report
  // ready over it
  await viewSelf(view).launchTrack!(
    track.trackId,
    {},
    isSettings(args.settings) ? args.settings : undefined,
  )
  // 0 skips the settle, so several adds can share one jb.waitReady
  const settleMs =
    typeof args.settleMs === 'number' ? args.settleMs : ADD_TRACK_SETTLE_MS
  return {
    shownInView: view.id,
    ...(settleMs > 0 ? await waitReady(settleMs, session) : {}),
  }
}

/**
 * One view from one spec entry, into the open session, through the same
 * launcher extension point `jb.loadSessionSpec` takes for each of its views —
 * so the entry means the same thing in both places, a ProteinView's
 * `connectedView` included. `session.launchView` is the other route and does
 * not: it is `addView` with a snapshot, so it never runs a view's launcher.
 *
 * A key the view does not take throws before anything opens. A spec has no
 * return channel and launches anyway with an error toast; an awaited call has
 * one, and a view that opened without the setting the agent typed is the
 * quietly-wrong answer this surface exists to refuse.
 */
async function addView(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  spec: ViewSpec,
  settleMs: number,
) {
  if (typeof spec !== 'object' || typeof spec.type !== 'string') {
    throw new Error(
      'jb.addView takes one view spec — an entry of a session spec\'s "views" array, e.g. { type: "LinearGenomeView", assembly, loc, tracks } (docs topic "session-spec")',
    )
  }
  const unlaunchable = viewTypeProblem(pluginManager, spec.type)
  if (unlaunchable) {
    throw new Error(unlaunchable)
  }
  const { view: entry, problem } = await launchableSpecView(pluginManager, spec)
  if (problem) {
    throw new Error(
      `${problem} — nothing was opened. docs topic "session-spec" lists the keys ${entry.type} takes`,
    )
  }
  const { created, view, failure } = await launchSpecView(
    session,
    pluginManager,
    entry,
  )
  if (failure) {
    throw new Error(failure.message, { cause: failure.cause })
  }
  if (!view) {
    throw new Error(`${entry.type} opened no view`)
  }
  const summary = {
    viewId: view.id,
    ...(created.length > 1 ? { created: created.map(v => v.id) } : {}),
  }
  return settleMs > 0
    ? { ...summary, ...(await waitReady(settleMs, session)) }
    : summary
}

interface SnapshotTarget {
  takeOutViewsMissingFrom?: (snapshot: unknown) => void
}

/**
 * The session as one document, rewritten: what `getSnapshot(session)` answers,
 * edited, handed back. MST reconciles by identifier, so a view, track or
 * display whose `id` the document keeps is patched in place and stays mounted,
 * one the document drops is closed, and an entry with no id is new. A view's
 * launch keys are accepted beside its built state — `loc` navigates it, a
 * `{ trackId }` entry in its `tracks` opens that track — because the partition
 * that sorts them runs on every snapshot the view is given, not only its
 * first.
 *
 * Top-level keys the document leaves out keep their current value, so
 * `{ views: [...] }` is a complete instruction.
 *
 * Views leave through the session's own detach first (ADR-069): `applySnapshot`
 * destroys what the target lacks in place, under components still mounted
 * over it, which is what undo had to route around.
 */
// A key nothing on the far side takes, per view entry. MST drops one silently,
// and the partition that names it runs at attach — which a view the document
// KEEPS never reaches, so the commonest edit was the quiet one.
//
// Reported, not refused, like the same mistake on a session spec: a document
// that works today must not cost the whole call. `acceptedKeys` answers for a
// legacy spelling too — a view's `passThrough` declares the ones its own
// preProcessSnapshot converts, which is what makes this a question about the
// view type rather than about whatever members the live node happens to have.
function unknownViewKeys(
  pluginManager: PluginManager,
  entry: unknown,
): string[] {
  if (
    typeof entry !== 'object' ||
    entry === null ||
    typeof (entry as { type?: unknown }).type !== 'string'
  ) {
    return []
  }
  const { type, views, ...keyed } = entry as Record<string, unknown> & {
    type: string
  }
  const nested = Array.isArray(views)
    ? views.flatMap(view => unknownViewKeys(pluginManager, view))
    : []
  if (!pluginManager.getElementTypeRecord('view').has(type)) {
    return nested
  }
  const viewType = pluginManager.getViewType(type)
  const accepted =
    viewType.acceptedKeys ??
    Object.keys(viewType.stateModel.properties as Record<string, unknown>)
  const unknown = Object.keys(keyed).filter(key => !accepted.includes(key))
  return [
    ...(unknown.length
      ? [
          `${unknownKeysMessage(type, unknown)}${
            viewType.launchKeys
              ? ''
              : ' — a document runs no launcher, so its launch keys go through jb.addView'
          }`,
        ]
      : []),
    ...nested,
  ]
}

async function setSession(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  document: unknown,
  settleMs: number,
) {
  if (
    typeof document !== 'object' ||
    document === null ||
    Array.isArray(document)
  ) {
    throw new Error(
      'jb.setSession takes the session as a document: what jb.mst.getSnapshot(jb.session) answers, edited. Top-level keys left out keep their current value.',
    )
  }
  const next = {
    ...(getSnapshot(session) as Record<string, unknown>),
    ...document,
  }
  // a lazily registered view or display type is not in the session's type union
  // until its model loads, and applySnapshot is synchronous
  await pluginManager.preloadSessionTypes(next)
  for (const problem of (Array.isArray(next.views) ? next.views : []).flatMap(
    entry => unknownViewKeys(pluginManager, entry),
  )) {
    session.notifyError(problem)
  }
  try {
    ;(session as unknown as SnapshotTarget).takeOutViewsMissingFrom?.(next)
    applySnapshot(session, next)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(
      `jb.setSession refused the document: ${detail.length > 1500 ? `${detail.slice(0, 1500)}…` : detail}`,
      { cause: e },
    )
  }
  const settle = await waitReady(settleMs, session)
  return { ...settle, session: sessionSummary(session) }
}

// Under the 45 s one evaluation gets from the Claude in Chrome extension: a
// cold hosted config settling for the full minute answered nothing there,
// while the settle result already names what is still not ready
const SPEC_SETTLE_DEFAULT_MS = 30_000

async function loadSpec(
  pluginManager: PluginManager,
  args: { spec: unknown; settleMs?: number },
) {
  const spec = args.spec
  const valid =
    typeof spec === 'object' &&
    spec !== null &&
    Array.isArray((spec as { views?: unknown }).views)
  if (!valid) {
    throw new Error('loadSessionSpec needs a spec object with a views array')
  }
  await loadSessionSpec(
    spec as Parameters<typeof loadSessionSpec>[0],
    pluginManager,
  )
  // the session was REPLACED by the spec load — settle against the new one
  const session = sessionOf(pluginManager)
  const settle = await waitReady(
    args.settleMs ?? SPEC_SETTLE_DEFAULT_MS,
    session,
  )
  return {
    ...settle,
    ...(session ? { session: sessionSummary(session) } : {}),
  }
}
