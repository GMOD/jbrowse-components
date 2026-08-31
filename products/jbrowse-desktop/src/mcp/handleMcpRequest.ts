import { loadSessionSpec } from '@jbrowse/app-core'
import { readConfObject } from '@jbrowse/core/configuration'
import {
  isSessionWithAddSessionTrack,
  isSessionWithSessionTracks,
} from '@jbrowse/core/util'
import {
  UNKNOWN,
  guessAdapter,
  guessTrackType,
  normalizeTrackInit,
  stripFileExtension,
} from '@jbrowse/core/util/tracks'

import type { McpBridgeRequest } from '../../electron/ipc/channelTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type {
  AbstractSessionModel,
  AbstractViewModel,
  FileLocation,
} from '@jbrowse/core/util/types'

// What the handlers ask of a view, duck-typed the way loadSessionSpec
// duck-types the session: the concrete view models live in plugins this module
// must not import, so members are optional and presence is the capability
// check.
interface ViewSelf {
  id: string
  type: string
  displayName?: string
  assemblyNames?: string[]
  coarseVisibleLocStrings?: string
  tracks?: { type: string; configuration: { trackId: string } }[]
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
  const trackId = typeof args.trackId === 'string' ? args.trackId : ''
  const view = pickView(session, args, 'hideTrack')
  const hidden = viewSelf(view).hideTrack!(trackId)
  return { hidden, view: view.id }
}

function fileLocation(spec: string): FileLocation {
  return /^https?:\/\//.test(spec)
    ? { uri: spec, locationType: 'UriLocation' }
    : { localPath: spec, locationType: 'LocalPathLocation' }
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
      'No session is open. Use the open tool with a config/session file or URL, or list_recent_sessions to find one.',
    )
  }
  switch (tool) {
    case 'get_session':
      return sessionSummary(session)
    case 'list_tracks':
      return listTracks(session, args)
    case 'load_session_spec':
      return loadSpec(pluginManager, args)
    case 'navigate':
      return navigate(session, args)
    case 'show_track':
      return showTrack(session, args)
    case 'hide_track':
      return hideTrack(session, args)
    case 'add_track':
      return addTrack(session, args)
    default:
      throw new Error(`Unknown tool: ${tool}`)
  }
}
