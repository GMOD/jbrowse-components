import { loadSessionSpec } from '@jbrowse/app-core'
import {
  getConf,
  getConfigurationSchemaDefinition,
  isConfigurationSlot,
  isSlotDefinitionEntry,
  preProcessSlotValues,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import {
  getRpcSessionId,
  isSessionWithAddSessionTrack,
  isSessionWithSessionTracks,
  parseLocString,
  renameRegionsIfNeeded,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  UNKNOWN,
  guessAdapter,
  guessTrackType,
  normalizeTrackInit,
  stripFileExtension,
} from '@jbrowse/core/util/tracks'
import * as mst from '@jbrowse/mobx-state-tree'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { autorun, observable, runInAction, when } from 'mobx'

import type { McpBridgeRequest } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { TrackInit } from '@jbrowse/core/util/tracks'
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

function sessionOf(pluginManager: PluginManager | undefined) {
  return (
    pluginManager?.rootModel as { session?: AbstractSessionModel } | undefined
  )?.session
}

function viewSummary(view: AbstractViewModel) {
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
  return JSON.stringify(
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
  )
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

async function waitReady(timeoutMs: number) {
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
  return outcome
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
  args: Record<string, unknown>,
) {
  const search =
    typeof args.search === 'string' ? args.search.toLowerCase() : ''
  const assembly = typeof args.assembly === 'string' ? args.assembly : ''
  const limit = typeof args.limit === 'number' ? args.limit : 100
  const confs = [
    ...session.tracks,
    ...(isSessionWithSessionTracks(session) ? session.sessionTracks : []),
  ]
  const seen = new Set<string>()
  const matches = confs
    .map(c => trackEntry(c))
    .filter(t => {
      const dup = seen.has(t.trackId)
      seen.add(t.trackId)
      return (
        !dup &&
        (!assembly || t.assemblyNames.includes(assembly)) &&
        (!search ||
          t.trackId.toLowerCase().includes(search) ||
          t.name.toLowerCase().includes(search))
      )
    })
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
  const view = viewId
    ? session.views.find(v => v.id === viewId)
    : session.views.find(v => typeof viewSelf(v)[capability] === 'function')
  if (!view) {
    throw new Error(
      viewId
        ? `No view with id "${viewId}". Open views: ${session.views.map(v => `${v.id} (${v.type})`).join(', ')}`
        : `No open view supports this. Open views: ${session.views.map(v => v.type).join(', ') || 'none'} — load_session_spec can open one.`,
    )
  }
  if (typeof viewSelf(view)[capability] !== 'function') {
    throw new Error(`View ${view.id} (${view.type}) does not support this`)
  }
  return view
}

async function navigate(
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  const loc = typeof args.loc === 'string' ? args.loc : ''
  if (!loc) {
    throw new Error('navigate needs a loc')
  }
  const view = pickView(session, args, 'navToLocString')
  const moved = await viewSelf(view).navToLocString!(loc)
  const settle = await waitReady(30_000)
  return {
    navigated: moved !== false,
    ...settle,
    view: viewSummary(view),
  }
}

function asTrackInit(value: unknown): TrackInit {
  const valid =
    typeof value === 'string' ||
    (typeof value === 'object' &&
      value !== null &&
      typeof (value as { trackId?: unknown }).trackId === 'string')
  if (!valid) {
    throw new Error(
      'track must be a trackId string or an object with a trackId',
    )
  }
  return value as TrackInit
}

async function showTrack(
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  const { trackId, trackSnapshot, displaySnapshot } = normalizeTrackInit(
    asTrackInit(args.track),
  )
  if (!session.getTrackById(trackId)) {
    throw new Error(
      `No track with trackId "${trackId}" — list_tracks shows what is available, add_track adds new data`,
    )
  }
  const view = pickView(session, args, 'showTrack')
  viewSelf(view).showTrack!(trackId, trackSnapshot, displaySnapshot)
  const settle = await waitReady(30_000)
  return { ...settle, view: viewSummary(view) }
}

function hideTrack(
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  const trackId = typeof args.track === 'string' ? args.track : ''
  const view = pickView(session, args, 'hideTrack')
  const hidden = viewSelf(view).hideTrack!(trackId)
  return { hidden, view: view.id }
}

// The identical routing showTrackGeneric runs at open time (core/util/tracks.ts
// #5591), applied to the live display: preProcessSlotValues so shorthand and
// legacy-key migrations speak the same vocabulary here, slots written onto the
// persistent display config, and anything else tried against the display
// model's conventionally-named setter action.
function applyDisplaySettings(
  track: TrackSelf,
  settings: Record<string, unknown>,
) {
  const applied = new Set<string>()
  const unapplied = new Set<string>()
  for (const display of track.displays ?? []) {
    const slots = preProcessSlotValues(display.configuration, settings)
    for (const [key, value] of Object.entries(slots)) {
      if (key === 'type') {
        unapplied.add(
          'type (changing the display type needs hide_track then show_track)',
        )
      } else if (isConfigurationSlot(display.configuration, key)) {
        // the key comes from runtime JSON; setConf's slot name is a
        // compile-time type
        // eslint-disable-next-line no-restricted-syntax
        display.configuration.setSlot(key, value)
        applied.add(key)
      } else {
        const setter = display[`set${key[0]!.toUpperCase()}${key.slice(1)}`]
        if (typeof setter === 'function') {
          ;(setter as (value: unknown) => void)(value)
          applied.add(`${key} (via setter)`)
        } else {
          unapplied.add(
            `${key} (not a config slot or settable prop on ${display.type})`,
          )
        }
      }
    }
  }
  return {
    applied: [...applied],
    ...(unapplied.size ? { unapplied: [...unapplied] } : {}),
  }
}

async function updateTrack(
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  const settings =
    typeof args.settings === 'object' && args.settings !== null
      ? (args.settings as Record<string, unknown>)
      : {}
  if (!Object.keys(settings).length) {
    throw new Error(
      'update_track needs a settings object with at least one key',
    )
  }
  const trackId = typeof args.track === 'string' ? args.track : ''
  const match = typeof args.match === 'string' ? args.match.toLowerCase() : ''
  const viewId = typeof args.viewId === 'string' ? args.viewId : ''
  const updated: Record<string, unknown>[] = []
  const shown: string[] = []
  for (const view of session.views.filter(v => !viewId || v.id === viewId)) {
    const v = viewSelf(view)
    for (const track of v.tracks ?? []) {
      const id = track.configuration.trackId
      const name = readConfObject(track.configuration, 'name') as string
      shown.push(id)
      const matched = trackId
        ? id === trackId
        : !match ||
          id.toLowerCase().includes(match) ||
          name.toLowerCase().includes(match)
      if (matched) {
        try {
          updated.push({
            trackId: id,
            view: v.id,
            ...applyDisplaySettings(track, settings),
          })
        } catch (e) {
          updated.push({ trackId: id, view: v.id, error: String(e) })
        }
      }
    }
  }
  if (!updated.length) {
    throw new Error(
      shown.length
        ? `No shown track matched. Shown tracks: ${shown.join(', ')}`
        : 'No tracks are shown in any view — show_track or load_session_spec first',
    )
  }
  const settle = await waitReady(30_000)
  return { updated, ...settle }
}

function firstAssemblyName(conf: AnyConfigurationModel) {
  const names = readConfObject(conf, 'assemblyNames') as string[]
  return names[0]
}

async function getFeatures(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  const trackId = typeof args.trackId === 'string' ? args.trackId : ''
  const conf = session.getTrackById(trackId)
  if (!conf) {
    throw new Error(
      `No track with trackId "${trackId}" — list_tracks shows what is available`,
    )
  }
  const limit = Math.min(typeof args.limit === 'number' ? args.limit : 30, 500)
  let regions: {
    refName: string
    start: number
    end: number
    assemblyName: string
  }[]
  if (typeof args.loc === 'string') {
    const assemblyName =
      typeof args.assembly === 'string'
        ? args.assembly
        : firstAssemblyName(conf)
    if (assemblyName === undefined) {
      throw new Error('The track names no assembly; pass assembly explicitly')
    }
    const assembly = await session.assemblyManager.waitForAssembly(assemblyName)
    if (!assembly) {
      throw new Error(`Assembly "${assemblyName}" could not be loaded`)
    }
    const parsed = parseLocString(args.loc, refName =>
      assembly.isValidRefName(refName),
    )
    const refName =
      assembly.getCanonicalRefName(parsed.refName) ?? parsed.refName
    const bounds = assembly.regions?.find(r => r.refName === refName)
    regions = [
      {
        assemblyName,
        refName,
        start: parsed.start ?? bounds?.start ?? 0,
        end: parsed.end ?? bounds?.end ?? Number.MAX_SAFE_INTEGER,
      },
    ]
  } else {
    // `in`, not evaluation: visibleRegions is a getter that THROWS ("width
    // undefined") until the view's component mounts and sets a width — a
    // freshly spec-loaded view stays in that state briefly even after the
    // app-phase marker reads ready, since a view with no width has no display
    // fetching anything.
    const view = session.views
      .map(v => viewSelf(v))
      .find(
        v => (!args.viewId || v.id === args.viewId) && 'visibleRegions' in v,
      )
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
    regions = visible.map(({ refName, start, end, assemblyName }) => ({
      refName,
      start,
      end,
      assemblyName,
    }))
  }
  // Main-thread adapter, not the CoreGetFeatures RPC: the RPC serializes every
  // feature in the region across the worker boundary before the limit can
  // apply. Here the features stay objects and only the returned slice is ever
  // turned into JSON.
  // The shown track's own rpcSessionId, so this shares the adapter instance —
  // parsed indexes and chunk caches included — that the display already
  // warmed; session.id is the cold-namespace fallback for un-shown tracks
  // (rpcSessionId lives on track models, so the walk cannot start at the
  // session).
  const trackModel = session.views
    .flatMap(v => viewSelf(v).tracks ?? [])
    .find(t => t.configuration.trackId === trackId)
  const sessionId = trackModel
    ? getRpcSessionId(trackModel)
    : (session.id ?? 'mcp')
  // The same translation the RPC base class runs: the regions above carry the
  // assembly's canonical refNames, and the file may spell them differently — a
  // query in the wrong namespace matches nothing and reads as "no data here".
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
  const shown = features.slice(0, limit).map(f => truncateStrings(f.toJSON()))
  return {
    total: features.length,
    ...(features.length > limit
      ? {
          note: `showing first ${limit} of ${features.length} — raise limit or narrow loc`,
        }
      : {}),
    regions,
    features: shown,
  }
}

// A feature's JSON can carry whole read sequences and per-base arrays; the
// inspection answer needs the shape, not the payload.
function truncateStrings(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.length > 300
      ? `${value.slice(0, 300)}...(${value.length} chars)`
      : value
  }
  if (Array.isArray(value)) {
    return value.length > 100
      ? [
          ...value.slice(0, 100).map(v => truncateStrings(v)),
          `...(${value.length} items)`,
        ]
      : value.map(v => truncateStrings(v))
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, truncateStrings(v)]),
    )
  }
  return value
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
async function evaluate(
  pluginManager: PluginManager,
  session: AbstractSessionModel,
  args: Record<string, unknown>,
) {
  const code = typeof args.code === 'string' ? args.code : ''
  if (!code) {
    throw new Error('evaluate needs code (an async function body)')
  }
  const maxBytes = typeof args.maxBytes === 'number' ? args.maxBytes : 50_000
  const jb = {
    mst,
    mobx: { autorun, observable, runInAction, when },
    readConfObject,
    getConf,
    describeSlots,
    parseLocString,
    getFeatureAdapterOrThrow,
    getRpcSessionId,
    renameRegionsIfNeeded,
    createStopToken,
    stopStopToken,
    waitReady,
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
    throw new Error('add_track needs a location (local path or URL)')
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
  const settle = await waitReady(30_000)
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
    throw new Error('load_session_spec needs a spec object with a views array')
  }
  await loadSessionSpec(
    spec as Parameters<typeof loadSessionSpec>[0],
    pluginManager,
  )
  const settle = await waitReady(60_000)
  const session = sessionOf(pluginManager)
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
      ? waitReady(typeof args.timeoutMs === 'number' ? args.timeoutMs : 30_000)
      : { settled: true, note: 'no session is open (start screen)' }
  }
  if (!pluginManager || !session) {
    throw new Error(
      'No session is open. Use the open tool with a config/session file or URL, or bare to list recent sessions.',
    )
  }
  switch (tool) {
    case 'inspect_session':
      return typeof args.path === 'string' && args.path
        ? inspectSession(session, args)
        : {
            ...sessionSummary(session),
            note: 'pass path to drill into the live model, e.g. "views.0" or "views.0.visibleLocStrings"',
          }
    case 'list_tracks':
      return listTracks(session, args)
    case 'load_session_spec':
      return loadSpec(pluginManager, args)
    case 'navigate':
      return navigate(session, args)
    case 'track':
      switch (args.action) {
        case 'show':
          return showTrack(session, args)
        case 'update':
          return updateTrack(session, args)
        case 'hide':
          return hideTrack(session, args)
        default:
          throw new Error('track needs an action: "show", "update", or "hide"')
      }
    case 'add_track':
      return addTrack(session, args)
    case 'get_features':
      return getFeatures(pluginManager, session, args)
    case 'evaluate':
      return evaluate(pluginManager, session, args)
    default:
      throw new Error(`Unknown tool: ${tool}`)
  }
}
