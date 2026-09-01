import { setReExportRegistry } from '@jbrowse/core/ReExports/registry'
import {
  getConf,
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  adapterByteLimit,
  measureRegionBytes,
} from '@jbrowse/core/rpc/byteBudget'
import {
  getRpcSessionId,
  isElectron,
  isSessionWithAddSessionTrack,
  parseLocString,
  renameRegionsIfNeeded,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  allSessionTracks,
  guessTrackConfForLocation,
  isSameAssemblyName,
  viewCanDisplayTrack,
  viewDisplayNames,
} from '@jbrowse/core/util/tracks'
import * as mst from '@jbrowse/mobx-state-tree'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import * as mobx from 'mobx'

// relative, not '@jbrowse/app-core': a package self-import would make this
// module depend on the barrel that exports it
import { loadSessionSpec } from '../SessionSpec/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
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
  displays?: (Record<string, unknown> & DisplaySelf)[]
}

interface ViewSelf {
  id: string
  type: string
  displayName?: string
  assemblyNames?: string[]
  coarseVisibleLocStrings?: string
  height?: number
  tracks?: TrackSelf[]
  trackContainers?: { tracks?: TrackSelf[] }[]
  views?: AbstractViewModel[]
  initialized?: boolean
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

// One level of composite-view flattening: a synteny or breakpoint-split view
// keeps its navigable, track-bearing linear views in `views`, so a scan of
// session.views alone cannot reach a session those views' own launcher built.
function allViews(session: AbstractSessionModel): AbstractViewModel[] {
  return session.views.flatMap(v => {
    const sub = viewSelf(v).views
    return [v, ...(Array.isArray(sub) ? sub : [])]
  })
}

// A synteny view holds its tracks on per-band containers INSTEAD of a `tracks`
// array, so a walk of view.tracks alone reaches none of them — see
// AbstractViewModel.trackContainers.
function viewTracks(view: AbstractViewModel): TrackSelf[] {
  const v = viewSelf(view)
  return [
    ...(v.tracks ?? []),
    ...(v.trackContainers ?? []).flatMap(c => c.tracks ?? []),
  ]
}

function allTracks(session: AbstractSessionModel): TrackSelf[] {
  return allViews(session).flatMap(v => viewTracks(v))
}

// The drawn display's on-screen state. `displayPhase` is the tree's own
// single-sourced vocabulary (render-core/displayPhase.ts) and the same one
// AppReadyMarker reads; `tooLarge` and `renderError` replace the display
// subtree rather than raising a snackbar, so a settle reporting only
// notifications calls them ready.
function displayState(track: TrackSelf) {
  const display = track.displays?.[0]
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

function viewSummary(view: AbstractViewModel): Record<string, unknown> {
  const v = viewSelf(view)
  return {
    id: v.id,
    type: v.type,
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

// The capture readiness contract: AppReadyMarker publishes data-app-phase from
// the session (ready = no view resolving an assembly, no display fetching),
// and it has to HOLD past the fetch debounce — one sample taken right after a
// navigation reads the pre-navigation frame as finished. See
// products/jbrowse-capture/src/waits.ts.
const READY_HOLD_MS = 1000

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
  // An errored track renders as a plausible frame, and a snackbar that fired
  // before an evaluate ran is unreachable from it — so every settle result
  // carries what the session is showing the human.
  const messages =
    session && 'snackbarMessages' in session
      ? (session.snackbarMessages as { message: string }[])
          .map(m => m.message)
          .slice(-5)
      : []
  // A display that refuses to draw — over the fetch-size gate, or errored —
  // replaces its own subtree instead of raising a snackbar, so notifications
  // alone report a clean settle over a browser with a blank track in it.
  const notReady = session
    ? allTracks(session)
        .map(t => ({ trackId: t.configuration.trackId, ...displayState(t) }))
        .filter(t => 'phase' in t || 'error' in t)
    : []
  return {
    ...outcome,
    ...(messages.length ? { notifications: messages } : {}),
    ...(notReady.length ? { notReady } : {}),
  }
}

function trackEntry(conf: AnyConfigurationModel) {
  const adapter = readConfObject(conf, 'adapter') as { type?: string }
  return {
    trackId: readConfObject(conf, 'trackId') as string,
    name: readConfObject(conf, 'name') as string,
    type: conf.type,
    ...(adapter.type ? { adapterType: adapter.type } : {}),
    assemblyNames: readConfObject(conf, 'assemblyNames') as string[],
  }
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
  const matches = allSessionTracks(session)
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
  const candidates = allViews(session)
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
  return canDisplay[0]!
}

function firstAssemblyName(conf: AnyConfigurationModel) {
  const names = readConfObject(conf, 'assemblyNames') as string[]
  return names[0]
}

interface JbRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
}

function shownTrackModel(session: AbstractSessionModel, trackId: string) {
  return allTracks(session).find(t => t.configuration.trackId === trackId)
}

async function locToRegion(
  session: AbstractSessionModel,
  conf: AnyConfigurationModel,
  loc: string,
  assemblyArg: string | undefined,
): Promise<JbRegion> {
  const assemblyName = assemblyArg ?? firstAssemblyName(conf)
  if (assemblyName === undefined) {
    throw new Error('The track names no assembly; pass assembly explicitly')
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
): Promise<JbRegion[]> {
  // `in`, not evaluation: visibleRegions is a getter that THROWS ("width
  // undefined") until the view's component mounts and sets a width — a
  // freshly spec-loaded view stays in that state briefly even after the
  // app-phase marker reads ready, since a view with no width has no display
  // fetching anything.
  const candidates = allViews(session)
    .map(v => viewSelf(v))
    .filter(v => (!viewId || v.id === viewId) && 'visibleRegions' in v)
  // among region-bearing views, the one actually showing the track wins — two
  // views on two assemblies would otherwise send the first view's namespace to
  // the second view's file, which answers nothing, silently
  const view =
    candidates.find(v =>
      v.tracks?.some(t => t.configuration.trackId === preferTrackId),
    ) ?? candidates[0]
  if (!view) {
    throw new Error(
      'No view that shows a region — pass loc, or open a linear view first',
    )
  }
  const deadline = Date.now() + 10_000
  let visible: NonNullable<ViewSelf['visibleRegions']> | undefined
  while (visible === undefined) {
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
  return visible.map(({ refName, start, end, assemblyName }) => ({
    refName,
    start,
    end,
    assemblyName,
  }))
}

// Main-thread adapter, not the CoreGetFeatures RPC: the RPC serializes every
// feature in the region across the worker boundary before any limit can
// apply. Here the features stay objects. The shown track's own rpcSessionId,
// so this shares the adapter instance — parsed indexes and chunk caches
// included — that the display already warmed (rpcSessionId lives on track
// models, so the walk cannot start at the session; session.id is the
// cold-namespace fallback for un-shown tracks). Regions are renamed the same
// way the RPC base class renames them: they arrive carrying the assembly's
// canonical refNames, and a file spelling them differently would otherwise
// answer nothing, silently.
async function fetchFeatures(
  pluginManager: PluginManager,
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
  const trackModel = shownTrackModel(session, trackId)
  const sessionId = trackModel
    ? getRpcSessionId(trackModel)
    : (session.id ?? 'mcp')
  const renamed = await renameRegionsIfNeeded(session.assemblyManager, {
    regions,
    adapterConfig: readConfObject(conf, 'adapter') as Record<string, unknown>,
    sessionId,
  })
  const dataAdapter = await getFeatureAdapterOrThrow({
    pluginManager,
    sessionId,
    adapterConfig: renamed.adapterConfig,
    sequenceAdapter: renamed.sequenceAdapter,
  })
  // The adapter's own declared limit where it has one, so this does not quietly
  // disagree with the size the track's display already refuses to render —
  // the reasoning BaseTrackModel.exportByteLimit spells out for "Save track
  // data", which is the other path that fetches because someone asked rather
  // than because a view scrolled.
  const byteLimit = agentByteLimit(
    readConfObject(conf, ['adapter', 'fetchSizeLimit']),
    requestedByteLimit,
  )
  const stopToken = createStopToken()
  // desktop's MCP relay gives up at 150s, so the read must not outlive it —
  // and an agent-triggered read of a dense region wants a ceiling either way
  const stopTimer = setTimeout(() => {
    stopStopToken(stopToken)
  }, 120_000)
  // The agent's "region too large". A display refuses to fetch over its own
  // gate and paints the reason; this path has no display, so without the same
  // question asked here an agent that names a whole chromosome pulls it — over
  // someone else's data host, onto the main thread, in the page it is about to
  // screenshot. Same index-only estimate the gated RPC takes first, and a
  // refusal rather than a truncation: a short answer that looked like the whole
  // answer is the failure this surface exists to prevent.
  const { tooLarge, bytes } = await measureRegionBytes({
    dataAdapter,
    regions: renamed.regions,
    byteLimit,
    stopToken,
  })
  if (tooLarge) {
    clearTimeout(stopTimer)
    throw new Error(
      `region too large for jb.getFeatures: the largest region is ~${bytes} bytes against a limit of ${byteLimit}. Narrow the region, or pass an explicit byteLimit if you mean to pull this much.`,
    )
  }
  // one array per region, flattened once at the end: a dense region returns
  // hundreds of thousands of features, so neither push(...array) — a
  // RangeError on the argument list — nor a concat per region is available
  const perRegion: Awaited<ReturnType<typeof dataAdapter.getFeaturesArray>>[] =
    []
  try {
    for (const region of renamed.regions) {
      perRegion.push(await dataAdapter.getFeaturesArray(region, { stopToken }))
    }
  } finally {
    clearTimeout(stopTimer)
  }
  return perRegion.flat()
}

// A LocalPathLocation only reads under Electron: in a browser openLocation
// throws "can't use local files in the browser" at the FIRST READ, not here, so
// accepting one would report a track added and then fail inside the display
// where the agent is least likely to connect it to what it asked for.
function fileLocation(spec: string): FileLocation {
  if (/^https?:\/\//.test(spec)) {
    return { uri: spec, locationType: 'UriLocation' }
  }
  if (!isElectron) {
    throw new Error(
      `jb.addTrack needs a URL in a browser, and "${spec}" is a local path. JBrowse Web cannot read local files except through the Add track file picker, which needs a real file chosen by hand.`,
    )
  }
  return { localPath: spec, locationType: 'LocalPathLocation' }
}

// Vocabulary introspection: every config slot a live config node's schema
// defines, so code never has to guess which settings keys exist — an unknown
// key is otherwise dropped silently, which is this format's known failure mode.
function describeSlots(conf: AnyConfigurationModel) {
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
    get session() {
      return live()
    },
    require: pluginManager.jbrequire,
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
    waitReady: (timeoutMs: number) => waitReady(timeoutMs, live()),
    sessionSummary: () => sessionSummary(live()),
    inspect: (path?: string, maxInspectBytes?: number) =>
      inspectSession(live(), { path, maxBytes: maxInspectBytes }),
    listTracks: (search?: string, limit?: number) =>
      listTracks(live(), search, limit),
    trackModel: (trackId: string) => shownTrackModel(live(), trackId),
    loadSessionSpec: (spec: Record<string, unknown>) =>
      loadSpec(pluginManager, { spec }),
    addTrack: (opts: Record<string, unknown>) =>
      addTrack(pluginManager, live(), opts),
    getFeatures: async (fetchArgs: {
      trackId: string
      loc?: string
      assembly?: string
      regions?: JbRegion[]
      viewId?: string
      // raises the region-too-large refusal for a read you mean to be big
      byteLimit?: number
    }) => {
      const session = live()
      const conf = session.getTrackById(fetchArgs.trackId)
      if (!conf) {
        throw new Error(`No track with trackId "${fetchArgs.trackId}"`)
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
            ))
      return fetchFeatures(
        pluginManager,
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

async function addTrack(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  if (!isSessionWithAddSessionTrack(session)) {
    throw new Error('This session cannot add tracks')
  }
  const location = typeof args.location === 'string' ? args.location : ''
  if (!location) {
    throw new Error('jb.addTrack needs a location (local path or URL)')
  }
  const assembly =
    typeof args.assembly === 'string' ? args.assembly : session.assemblyNames[0]
  if (assembly === undefined) {
    throw new Error('The session has no assemblies to attach the track to')
  }
  if (!session.assemblyNames.includes(assembly)) {
    throw new Error(
      `Assembly "${assembly}" is not in this session (has: ${session.assemblyNames.join(', ')})`,
    )
  }
  const conf = guessTrackConfForLocation(
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
  const settle = await waitReady(30_000, session)
  return { ...summary, ...settle, shownInView: view.id }
}

async function loadSpec(
  pluginManager: PluginManager,
  args: Record<string, unknown>,
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
  const settle = await waitReady(60_000, session)
  return {
    ...settle,
    ...(session ? { session: sessionSummary(session) } : {}),
  }
}
