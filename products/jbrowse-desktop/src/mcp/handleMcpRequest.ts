import { loadSessionSpec } from '@jbrowse/app-core'
import { setReExportRegistry } from '@jbrowse/core/ReExports/registry'
import {
  getConf,
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  getRpcSessionId,
  isSessionWithAddSessionTrack,
  parseLocString,
  renameRegionsIfNeeded,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  UNKNOWN,
  allSessionTracks,
  guessAdapter,
  guessTrackType,
  stripFileExtension,
} from '@jbrowse/core/util/tracks'
import * as mst from '@jbrowse/mobx-state-tree'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import * as mobx from 'mobx'

import type { McpBridgeRequest } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  AbstractSessionModel,
  AbstractViewModel,
  FileLocation,
} from '@jbrowse/core/util/types'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

// What the handlers ask of a view, duck-typed the way loadSessionSpec
// duck-types the session: the concrete view models live in plugins this module
// must not import, so members are optional and presence is the capability
// check.
interface TrackSelf extends IStateTreeNode {
  type: string
  configuration: AnyConfigurationModel & { trackId: string }
  displays?: (Record<string, unknown> & {
    type: string
    configuration: AnyConfigurationModel
  })[]
}

interface ViewSelf {
  id: string
  type: string
  displayName?: string
  assemblyNames?: string[]
  coarseVisibleLocStrings?: string
  tracks?: TrackSelf[]
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

function sessionOf(pluginManager: PluginManager | undefined) {
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
    ...(v.tracks
      ? {
          tracks: v.tracks.map(t => ({
            trackId: t.configuration.trackId,
            display: t.type,
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
function safeJson(value: unknown) {
  const seen = new WeakSet<object>()
  // typed by hand: JSON.stringify's declared return is string, but a bare
  // Symbol/undefined at the top level really does yield undefined at runtime
  const json = JSON.stringify(
    isStateTreeNode(value) ? getSnapshot(value) : value,
    (_key, v: unknown) => {
      if (typeof v === 'function') {
        return '[function]'
      }
      if (typeof v === 'bigint') {
        return `${v}`
      }
      if (v !== null && typeof v === 'object' && !isStateTreeNode(v)) {
        if (seen.has(v)) {
          return '[circular]'
        }
        seen.add(v)
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

async function waitReady(timeoutMs: number, session?: AbstractSessionModel) {
  const deadline = Date.now() + timeoutMs
  let readySince: number | undefined
  let outcome
  while (outcome === undefined) {
    const ready =
      document.querySelector('[data-app-phase="ready"]') !== null &&
      document.querySelector('[data-testid="loading-overlay"]') === null
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
  return {
    ...outcome,
    ...(messages.length ? { notifications: messages } : {}),
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
) {
  const viewId = typeof args.viewId === 'string' ? args.viewId : ''
  const candidates = allViews(session)
  const view = viewId
    ? candidates.find(v => v.id === viewId)
    : candidates.find(v => typeof viewSelf(v)[capability] === 'function')
  if (!view) {
    throw new Error(
      viewId
        ? `No view with id "${viewId}". Open views: ${candidates.map(v => `${v.id} (${v.type})`).join(', ')}`
        : `No open view supports this. Open views: ${candidates.map(v => v.type).join(', ') || 'none'} — jb.loadSessionSpec can open one.`,
    )
  }
  if (typeof viewSelf(view)[capability] !== 'function') {
    throw new Error(`View ${view.id} (${view.type}) does not support this`)
  }
  return view
}

function firstAssemblyName(conf: AnyConfigurationModel) {
  const names = readConfObject(conf, 'assemblyNames') as string[]
  return names[0]
}

interface McpRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
}

function shownTrackModel(session: AbstractSessionModel, trackId: string) {
  return allViews(session)
    .flatMap(v => viewSelf(v).tracks ?? [])
    .find(t => t.configuration.trackId === trackId)
}

async function locToRegion(
  session: AbstractSessionModel,
  conf: AnyConfigurationModel,
  loc: string,
  assemblyArg: string | undefined,
): Promise<McpRegion> {
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
): Promise<McpRegion[]> {
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
  regions: McpRegion[],
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
  const stopToken = createStopToken()
  // the MCP relay gives up at 150s, so the read must not outlive it
  const stopTimer = setTimeout(() => {
    stopStopToken(stopToken)
  }, 120_000)
  const features = []
  try {
    for (const region of renamed.regions) {
      features.push(
        ...(await dataAdapter.getFeaturesArray(region, { stopToken })),
      )
    }
  } finally {
    clearTimeout(stopTimer)
  }
  return features
}

function fileLocation(spec: string): FileLocation {
  return /^https?:\/\//.test(spec)
    ? { uri: spec, locationType: 'UriLocation' }
    : { localPath: spec, locationType: 'LocalPathLocation' }
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
async function ensureReExports() {
  setReExportRegistry((await import('@jbrowse/core/ReExports/modules')).default)
}

async function evaluate(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  await ensureReExports()
  const code = typeof args.code === 'string' ? args.code : ''
  if (!code) {
    throw new Error('run_javascript needs code (an async function body)')
  }
  const maxBytes = typeof args.maxBytes === 'number' ? args.maxBytes : 50_000
  const jb = {
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
    waitReady: (timeoutMs: number) => waitReady(timeoutMs, session),
    sessionSummary: () => sessionSummary(session),
    inspect: (path?: string, maxInspectBytes?: number) =>
      inspectSession(session, { path, maxBytes: maxInspectBytes }),
    listTracks: (search?: string, limit?: number) =>
      listTracks(session, search, limit),
    trackModel: (trackId: string) => shownTrackModel(session, trackId),
    loadSessionSpec: (spec: Record<string, unknown>) =>
      loadSpec(pluginManager, { spec }),
    addTrack: (opts: Record<string, unknown>) => addTrack(session, opts),
    getFeatures: async (fetchArgs: {
      trackId: string
      loc?: string
      assembly?: string
      regions?: McpRegion[]
      viewId?: string
    }) => {
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
      return fetchFeatures(pluginManager, session, fetchArgs.trackId, regions)
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(
    'session',
    'rootModel',
    'pluginManager',
    'jb',
    `return (async () => {\n${code}\n})()`,
  ) as (
    session: AbstractSessionModel,
    rootModel: unknown,
    pluginManager: PluginManager,
    jbHelpers: typeof jb,
  ) => Promise<unknown>
  const value = await fn(session, pluginManager.rootModel, pluginManager, jb)
  if (value === undefined) {
    return { note: 'code returned undefined — use "return" for a value' }
  }
  const json = safeJson(value)
  return json.length <= maxBytes
    ? { bytes: json.length, value: JSON.parse(json) as unknown }
    : {
        bytes: json.length,
        note: `result larger than maxBytes=${maxBytes} — truncated preview follows; aggregate in code or raise maxBytes`,
        preview: json.slice(0, maxBytes),
      }
}

async function addTrack(
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
  const file = fileLocation(location)
  const index =
    typeof args.index === 'string' ? fileLocation(args.index) : undefined
  const adapter = guessAdapter(file, index, undefined, session)
  if (adapter.type === UNKNOWN) {
    throw new Error(
      `Could not infer a data format from "${location}" — is the extension a supported format (BAM/CRAM/VCF/BED/GFF3/bigWig/...)?`,
    )
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
  const fileName = location.split(/[/\\]/).at(-1) ?? location
  const trackId = `${stripFileExtension(fileName)}-${Date.now()}`
  session.addSessionTrackConf({
    type: guessTrackType(adapter.type, session, file),
    trackId,
    name: typeof args.name === 'string' ? args.name : fileName,
    assemblyNames: [assembly],
    adapter,
  })
  const summary = { trackId, adapterType: adapter.type, assembly }
  if (args.show === false) {
    return summary
  }
  const view = pickView(session, args, 'showTrack')
  viewSelf(view).showTrack!(trackId)
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

export async function handleMcpRequest(
  request: McpBridgeRequest,
  pluginManager: PluginManager | undefined,
): Promise<unknown> {
  const { tool, args } = request
  const session = sessionOf(pluginManager)
  if (tool === 'wait_ready') {
    return session
      ? waitReady(
          typeof args.timeoutMs === 'number' ? args.timeoutMs : 30_000,
          session,
        )
      : { settled: true, note: 'no session is open (start screen)' }
  }
  if (tool === 'session_id') {
    return { id: session?.id ?? null }
  }
  if (!pluginManager || !session) {
    throw new Error(
      'No session is open. Use the open tool with a config/session file or URL, or bare to list recent sessions.',
    )
  }
  if (tool === 'run_javascript') {
    return evaluate(pluginManager, session, args)
  }
  throw new Error(`Unknown tool: ${tool} — use run_javascript`)
}
