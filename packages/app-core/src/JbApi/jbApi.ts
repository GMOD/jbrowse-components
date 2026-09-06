import { setReExportRegistry } from '@jbrowse/core/ReExports/registry'
import {
  getConf,
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
  readConfObject,
} from '@jbrowse/core/configuration'
import {
  releaseAdapterSession,
  retainAdapterSession,
} from '@jbrowse/core/data_adapters/adapterSessionRefcount'
import { adapterConfigCacheKey } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { adapterByteLimit } from '@jbrowse/core/rpc/byteBudget'
import {
  getRpcSessionId,
  isElectron,
  isSessionWithAddSessionTrack,
  objectHash,
  parseLocString,
  renameRegionsIfNeeded,
} from '@jbrowse/core/util'
import { openTracks, openViews } from '@jbrowse/core/util/openViews'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  allSessionTracks,
  getConfAssemblyNamesOrNone,
  guessTrackConfForLocation,
  isSameAssemblyName,
  viewCanDisplayTrack,
  viewDisplayNames,
} from '@jbrowse/core/util/tracks'
import * as mst from '@jbrowse/mobx-state-tree'
import { getSnapshot, getType, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import * as mobx from 'mobx'

// relative, not '@jbrowse/app-core': a package self-import would make this
// module depend on the barrel that exports it
import { loadSessionSpec } from '../SessionSpec/index.ts'

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
  error?: unknown
  // read only by viewSummary, whose output mirrors the nesting for the reader;
  // ENUMERATION goes through the census helpers (openViews/openTracks) below
  views?: AbstractViewModel[]
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
    }
  } catch (e) {
    return { display: display.type, error: String(e) }
  }
}

export function sessionOf(pluginManager: PluginManager | undefined) {
  return (
    pluginManager?.rootModel as { session?: AbstractSessionModel } | undefined
  )?.session
}

// A view whose init failed (its assembly was never found) paints the error in
// place of a genome and raises no toast, and stays uninitialized: without
// this, a spec with "volvix" for "volvox" settled false with nothing said.
function viewState(v: ViewSelf) {
  return {
    ...(v.error === undefined ? {} : { error: String(v.error) }),
    ...(v.error === undefined && v.initialized === false
      ? { phase: 'initializing' }
      : {}),
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
    ...(Array.isArray(v.views) && v.views.length
      ? { views: v.views.map(sub => viewSummary(sub)) }
      : {}),
  }
}

function sessionSummary(session: AbstractSessionModel) {
  return {
    name: session.name,
    assemblyNames: session.assemblyNames,
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

function inspectSession(
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  const path = typeof args.path === 'string' ? args.path : ''
  const maxBytes = typeof args.maxBytes === 'number' ? args.maxBytes : 20_000
  let node: unknown = session
  const walked: string[] = []
  for (const segment of path.split('.').filter(Boolean)) {
    node =
      node !== null && typeof node === 'object'
        ? (node as Record<string, unknown>)[segment]
        : undefined
    if (node === undefined) {
      throw new Error(
        `Nothing at "${path}" (undefined after "${walked.join('.') || '(root)'}"). Inspect the parent path to see its keys and getters.`,
      )
    }
    walked.push(segment)
  }
  const members =
    node !== null && typeof node === 'object' && !Array.isArray(node)
      ? memberNames(node)
      : { getters: [], methods: [] }
  const json = safeJson(node)
  const base = {
    path: path || '(session root)',
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
        note: `too large to return whole — ${plain.length} items; index in with .N or raise maxBytes`,
        items: plain.slice(0, 20).map(item => describeBrief(item)),
      }
    : {
        ...base,
        note: 'too large to return whole — drill down by path or raise maxBytes',
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
// (APP_SETTLED_HOLD_MS) — reached independently there, and measured; see
// REJECTED_IDEAS under "Waiting out a screenshot action's work".
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
  const pageHeight = win.document.documentElement.scrollHeight
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
  return pageHeight > windowHeight || views.length
    ? {
        pageHeight,
        windowHeight,
        scrollY: Math.round(win.scrollY),
        views,
        note: 'the session is taller than the window; a viewport screenshot cuts these views off — shrink track heights, or screenshot with fullPage: true. A view with a negative top is scrolled out above the viewport (scrollY says by how much), not missing',
      }
    : undefined
}

function trackEntry(conf: BaseTrackConfig) {
  const adapter = readConfObject(conf, 'adapter')
  return {
    trackId: conf.trackId,
    name: readConfObject(conf, 'name'),
    type: conf.type,
    ...(adapter.type ? { adapterType: adapter.type } : {}),
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
  capability: 'navToLocString' | 'showTrack' | 'hideTrack',
  wants?: {
    assembly?: string
    trackType?: string
    pluginManager?: PluginManager
  },
) {
  const viewId = typeof args.viewId === 'string' ? args.viewId : ''
  const candidates = openViews(session)
  if (viewId) {
    const named = candidates.find(v => v.id === viewId)
    if (!named) {
      throw new Error(
        `No view with id "${viewId}". Open views: ${candidates.map(v => `${v.id} (${v.type})`).join(', ')}`,
      )
    }
    if (typeof viewSelf(named)[capability] !== 'function') {
      throw new Error(`View ${named.id} (${named.type}) does not support this`)
    }
    return named
  }
  const able = candidates.filter(
    v => typeof viewSelf(v)[capability] === 'function',
  )
  if (!able.length) {
    throw new Error(
      `No open view supports this. Open views: ${candidates.map(v => v.type).join(', ') || 'none'} — jb.loadSessionSpec can open one.`,
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
  return onlyView(canDisplay, 'could take this')
}

function describeView(view: AbstractViewModel) {
  const v = viewSelf(view)
  const on = v.assemblyNames?.length ? ` on ${v.assemblyNames.join(', ')}` : ''
  const at = v.coarseVisibleLocStrings ? ` at ${v.coarseVisibleLocStrings}` : ''
  return `${v.id} (${v.type}${on}${at})`
}

// A name that matches several views has no right first answer: two linear
// views of one assembly at two loci both "show the track", and taking the
// first restyles one row or reads one region while the settle reports both.
// The named-but-missing case already throws and lists the open views, so the
// unnamed-and-plural case does the same.
function onlyView(candidates: AbstractViewModel[], relation: string) {
  const [first, ...rest] = candidates
  if (!first) {
    throw new Error('No open view')
  }
  if (rest.length) {
    throw new Error(
      `${candidates.length} views ${relation}: ${candidates.map(v => describeView(v)).join('; ')} — pass viewId to say which`,
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
        `No view with id "${viewId}". Open views: ${candidates.map(v => describeView(v)).join('; ') || 'none'}`,
      )
    }
    return named
  }
  if (!candidates.length) {
    throw new Error('No view is open — jb.loadSessionSpec can open one')
  }
  return onlyView(candidates, 'are open')
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
  const pool =
    viewId === undefined
      ? allTracks(session)
      : viewTracks(viewById(session, viewId))
  const shown = pool.filter(t => t.configuration.trackId === trackId)
  if (shown.length > 1) {
    const where = openViews(session)
      .filter(v => viewTracks(v).some(t => t.configuration.trackId === trackId))
      .map(v => describeView(v))
    throw new Error(
      `"${trackId}" is shown in ${shown.length} views: ${where.join('; ')} — pass viewId to say which`,
    )
  }
  const [track] = shown
  // undefined here was followed by ".activeDisplay" on the next line of every
  // agent's code, and a TypeError says nothing about which of the two causes
  // it was
  if (!track) {
    throw new Error(
      session.getTrackById(trackId)
        ? `"${trackId}" is not shown in ${viewId === undefined ? 'any open view' : `view ${viewId}`} — view.showTrack("${trackId}") first; jb.sessionSummary() lists what each view shows`
        : `No track with trackId "${trackId}" — jb.listTracks() shows what is available`,
    )
  }
  return track
}

async function locToRegion(
  session: AbstractSessionModel,
  conf: AnyConfigurationModel,
  loc: string,
  assemblyArg: string | undefined,
): Promise<JbRegion> {
  // getConfAssemblyNamesOrNone, not the assemblyNames slot: an assembly's own
  // sequence track has no such slot and answers through its parent assembly
  const trackAssemblies = getConfAssemblyNamesOrNone(conf)
  const assemblyName = assemblyArg ?? trackAssemblies[0]
  if (assemblyName === undefined) {
    throw new Error('The track names no assembly; pass assembly explicitly')
  }
  // a named assembly the track is not on renames the region against the wrong
  // alias set and answers with the wrong assembly's coordinates, or nothing
  if (
    assemblyArg !== undefined &&
    trackAssemblies.length &&
    !trackAssemblies.some(name =>
      isSameAssemblyName(name, assemblyArg, session.assemblyManager),
    )
  ) {
    throw new Error(
      `Track "${conf.trackId}" is on ${trackAssemblies.join(', ')}, not "${assemblyArg}"`,
    )
  }
  const assembly = await session.assemblyManager.waitForAssembly(assemblyName)
  if (!assembly) {
    throw new Error(`Assembly "${assemblyName}" could not be loaded`)
  }
  const parsed = parseLocString(loc, refName =>
    assembly.isValidRefName(refName),
  )
  const refName = assembly.getCanonicalRefName(parsed.refName) ?? parsed.refName
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
  const regionBearing = openViews(session).filter(
    v => (!viewId || v.id === viewId) && 'visibleRegions' in v,
  )
  if (!regionBearing.length) {
    throw new Error(
      'No view that shows a region — pass loc, or open a linear view first',
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
      `No open view is on ${trackAssemblies.join(', ')} (open views: ${regionBearing.map(v => describeView(v)).join('; ')}) — pass loc, or open a view on that assembly`,
    )
  }
  // among region-bearing views, the ones actually showing the track — two
  // views on two assemblies would otherwise send the first view's namespace to
  // the second view's file, which answers nothing, silently
  const showing = candidates.filter(v =>
    viewTracks(v).some(t => t.configuration.trackId === preferTrackId),
  )
  const chosen = onlyView(
    showing.length ? showing : candidates,
    showing.length ? `show "${preferTrackId}"` : 'show a region',
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
  const stopToken = createStopToken()
  // desktop's MCP relay gives up at 150s, so the read must not outlive it —
  // and an agent-triggered read of a dense region wants a ceiling either way
  const stopTimer = setTimeout(() => {
    stopStopToken(stopToken)
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
      { adapterConfig, regions, scope: 'largestRegion', stopToken },
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
      stopToken,
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
function fileLocation(spec: string): FileLocation {
  if (/^https?:\/\//.test(spec)) {
    return { uri: spec, locationType: 'UriLocation' }
  }
  // The app's working directory is not the agent's, and a relative path
  // resolves against the app's: under a packaged app that is "/", so the read
  // fails at the first fetch and reports through the display, not here.
  if (!/^(?:\/|[a-zA-Z]:[\\/]|\\\\)/.test(spec)) {
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
  defaultValue: unknown
}

// Vocabulary introspection: every config slot a live config node's schema
// defines, so code never has to guess which settings keys exist — an unknown
// key is not an error, only an entry in applyDisplaySettings' `unapplied` list.
function describeSlots(
  conf: AnyConfigurationModel,
): Record<string, SlotDescription> {
  const definition = getConfigurationSchemaDefinition(conf) ?? {}
  return Object.fromEntries(
    Object.entries(definition).flatMap(([name, def]) =>
      isSlotDefinitionEntry(def)
        ? [
            [
              name,
              {
                type: def.type,
                ...(def.description ? { description: def.description } : {}),
                defaultValue: def.defaultValue,
              },
            ],
          ]
        : [],
    ),
  )
}

// The raw primitive under all of the above: Claude-authored code against the
// live model graph. The renderer already runs with nodeIntegration and the
// bridge socket is user-only, so this grants what the surface as a whole
// already grants — expressed directly instead of through a curated verb.
// The re-export registry is what pluginManager.jbrequire serves: the same
// pinned ABI module names external plugins link against (ReExports/modules.ts,
// abiBaseline.json). It stays empty until a runtime plugin loads, so each
// evaluate (re)installs it — import() is memoized, so this is one lookup and
// an idempotent assignment, with no module-level flag to hold.
export async function ensureReExports() {
  setReExportRegistry((await import('@jbrowse/core/ReExports/modules')).default)
}

// The front door for an agent that just found `jb` and knows nothing else —
// jbrowse-web's console banner and meta tag point here, because a browser
// agent has no MCP docs tool and no initialize instructions to learn the
// contract from.
const JB_HELP = `jb drives this JBrowse app programmatically (window.jb in a browser; the same object is the "jb" argument of JBrowse Desktop's run_javascript MCP tool).

Orient first: jb.sessionSummary(). Introspect, never guess: jb.listTracks(search?) answers { total, tracks } with the trackIds; jb.describeSlots(jb.trackModel('someTrackId').activeDisplay.configuration) for the settings keys a display accepts — an unknown settings key is not an error, it lands in applyDisplaySettings' "unapplied" list, so read the report; jb.inspect('views.0') for a live node's getters, actions and modelType.

The model is mobx-state-tree: mutate only through actions (raw assignment throws), and write display settings with track.applyDisplaySettings(settings). Build views declaratively with jb.loadSessionSpec({ views: [{ type: 'LinearGenomeView', assembly, loc, tracks: [...] }] }); arrange the views already open into panels with session.layoutViews({ direction: 'horizontal', children: [{ views: [viewId] }, ...] }) — leaves name view ids or indexes into session.views; add data with jb.addTrack({ location }) (an absolute path or a URL); read data with await jb.getFeatures({ trackId, loc?, assembly?, byteLimit? }) (or jb.getFeatures(trackId, loc?, opts?)), which renames refNames ("chr1" vs "1") so the file answers and reads on the worker the track's display uses — raw adapter code must call jb.renameRegionsIfNeeded itself. After changing anything, await jb.waitReady(ms) and read its notifications and notReady lists before trusting the screen.

Views nest and several can be open. jb.view(viewId?) is the open view, and jb.view(), jb.trackModel(trackId), jb.visibleRegions() and jb.addTrack throw naming the candidates rather than picking one when more than one view could answer — pass viewId (from jb.sessionSummary()) to say which.

Full guide: https://jbrowse.org/jb2/docs/agents_live_model (JBrowse Desktop serves the same guide offline through its MCP docs tool — Help menu, "Connect an AI agent...").`

// The helper library an agent drives the app through. Built from the plugin
// manager alone, so one of these serves a whole app rather than one session —
// which is what lets jbrowse-web hand the same object to every caller for the
// life of a plugin manager.
export function createJbApi(pluginManager: PluginManager) {
  // Resolved per call, never captured: jb.loadSessionSpec REPLACES the session,
  // and a helper bound to the old one keeps answering from a detached tree —
  // which reads as stale data rather than throwing, so the agent is told about
  // a session that no longer exists. `jb.session` is how code re-reads it after
  // a spec load.
  const live = () => {
    const current = sessionOf(pluginManager)
    if (!current) {
      throw new Error('No session is open')
    }
    return current
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
    parseLocString,
    getFeatureAdapterOrThrow,
    getRpcSessionId,
    renameRegionsIfNeeded,
    createStopToken,
    stopStopToken,
    // a default because an omitted number made the deadline NaN, and a view
    // that never readied then held the call open to the relay's own timeout
    waitReady: (timeoutMs = 30_000) => waitReady(timeoutMs, live()),
    sessionSummary: () => sessionSummary(live()),
    inspect: (path?: string, maxInspectBytes?: number) =>
      inspectSession(live(), { path, maxBytes: maxInspectBytes }),
    listTracks: (search?: string, limit?: number) =>
      listTracks(live(), search, limit),
    view: (viewId?: string) => viewById(live(), viewId),
    trackModel: (trackId: string, viewId?: string) =>
      shownTrackModel(live(), trackId, viewId),
    visibleRegions: (viewId?: string) => visibleRegionsOf(live(), viewId),
    loadSessionSpec: (spec: Record<string, unknown>, settleMs?: number) =>
      loadSpec(pluginManager, { spec, settleMs }),
    addTrack: (opts: {
      location: string | string[]
      index?: string
      assembly?: string
      name?: string
      show?: boolean
      viewId?: string
      settleMs?: number
    }) => addTrack(pluginManager, live(), opts),
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
            loc?: string
            assembly?: string
            regions?: JbRegion[]
            viewId?: string
            // raises the region-too-large refusal for a read you mean to be big
            byteLimit?: number
          },
      positionalLoc?: string,
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
      const regions =
        fetchArgs.regions ??
        (fetchArgs.loc !== undefined
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
            ))
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

async function addTrack(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  if (!isSessionWithAddSessionTrack(session)) {
    throw new Error('This session cannot add tracks')
  }
  const location = locationsOf(args.location)
  if (!location.length) {
    throw new Error(
      'jb.addTrack needs a location (an absolute local path or a URL)',
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
  if (args.show === false) {
    return summary
  }
  const view = pickView(session, args, 'showTrack', {
    assembly,
    trackType: conf.type,
    pluginManager,
  })
  viewSelf(view).showTrack!(conf.trackId)
  const shown = { ...summary, shownInView: view.id }
  // 0 skips the settle, so several adds can share one jb.waitReady
  const settleMs =
    typeof args.settleMs === 'number' ? args.settleMs : ADD_TRACK_SETTLE_MS
  return settleMs > 0
    ? { ...shown, ...(await waitReady(settleMs, session)) }
    : shown
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
