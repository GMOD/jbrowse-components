import { createElement } from 'react'

import { getEnv, isFeature } from '@jbrowse/core/util'
import { fetchHub } from '@jbrowse/core/util/fetchHub'
import { isSequenceUri, makeAssembly } from '@jbrowse/core/util/makeAssembly'
import { guessTrackConf } from '@jbrowse/core/util/tracks'
import { autorun } from 'mobx'
import { createRoot } from 'react-dom/client'

import JBrowseLinearGenomeView from './JBrowseLinearGenomeView/index.ts'
import createViewState from './createViewState.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type { ViewStateOptions } from './createViewState.ts'
import type { HubConfig } from '@jbrowse/core/util/fetchHub'
import type { LooseTrackInput } from '@jbrowse/core/util/tracks'

type Tracks = NonNullable<ViewStateOptions['tracks']>
type TrackConf = Record<string, unknown>
/** A full track config, a bare data-file URL, or `{ uri, index?, ...extra }` —
 * the loose forms are expanded via core's guessTrackConf at mount time. */
type TrackInput = string | TrackConf
type AssemblyConfig = Record<string, unknown>
type SearchAdapters = ViewStateOptions['aggregateTextSearchAdapters']
type SessionSnapshot = ViewStateOptions['defaultSession']

function isLooseTrack(track: TrackInput): track is string | LooseTrackInput {
  return typeof track === 'string' || (!('adapter' in track) && 'uri' in track)
}

// Stamp the view's single assembly onto a full-config track that omits
// assemblyNames. The embedded view has exactly one assembly, so it's
// unambiguous — and doing it here frees every host (R htmlwidgets, anywidget,
// vanilla JS) from computing the name itself. Loose tracks get the same name
// through guessTrackConf's `assemblyName` argument below.
export function withAssemblyName(track: TrackConf, assemblyName?: string) {
  return assemblyName !== undefined && !('assemblyNames' in track)
    ? { ...track, assemblyNames: [assemblyName] }
    : track
}

// Expand any loose entries (bare URL, or { uri, index? }) into full track
// configs using core's guessTrackConf; full configs pass through unchanged. The
// view model carries the pluginManager whose format plugins drive the guess.
function resolveTracks(
  tracks: TrackInput[],
  viewState: ViewModel,
  assemblyName?: string,
): Tracks {
  const { pluginManager } = getEnv(viewState)
  return tracks.map(track =>
    isLooseTrack(track)
      ? guessTrackConf(track, pluginManager, assemblyName)
      : track,
  )
}

/**
 * The shapes an assembly can take, discriminated at resolve time: a sequence
 * file URL (`'.../hg38.fa.gz'`, `.2bit`, ...) built into an assembly via
 * `makeAssembly`; a hub name (`'hg38'`, `'GCF_...'`) fetched from jbrowse.org;
 * a full hub config (as `fetchHub` returns); or a bare assembly config (e.g.
 * from `makeAssembly`) — the latter two both being plain config objects.
 */
export type AssemblyInput = string | AssemblyConfig

export interface CreateLinearGenomeViewOptions {
  assembly: AssemblyInput
  /** tracks to open (full configs, bare data-file URLs, or `{ uri, index? }`); a
   * `defaultSession` owns display instead when given */
  tracks?: TrackInput[]
  /** a serialized view; when present it owns the initial location and layout */
  defaultSession?: SessionSnapshot
  /** e.g. `chr1:1-1000` or a gene name; ignored when a `defaultSession` positions the view */
  location?: string
  /** merged with any search adapters the resolved hub already provides */
  aggregateTextSearchAdapters?: SearchAdapters
  internetAccounts?: ViewStateOptions['internetAccounts']
  plugins?: ViewStateOptions['plugins']
  makeWorkerInstance?: ViewStateOptions['makeWorkerInstance']
  configuration?: ViewStateOptions['configuration']
  /** fires with the throttled visible region as the user pans/zooms */
  onLocationChange?: (location: string) => void
  /** fires with the serialized feature when one is clicked/selected */
  onFeatureSelect?: (feature: unknown) => void
}

export interface LinearGenomeViewController {
  /** the underlying MST model, or `undefined` until the first build resolves */
  readonly viewState: ViewModel | undefined
  /** resolves with the model once the (re)build settles */
  whenReady(): Promise<ViewModel>
  setLocation(location: string): Promise<void>
  /** swap the genome; rebuilds the engine (any of the three assembly shapes) */
  setAssembly(assembly: AssemblyInput): void
  /** load/clear a serialized session; rebuilds the engine */
  setSession(defaultSession?: SessionSnapshot): void
  setTracks(tracks: TrackInput[]): void
  addTrack(track: TrackInput): void
  removeTrack(trackId: string): void
  destroy(): void
}

interface ResolvedAssembly {
  assembly: AssemblyConfig
  aggregateTextSearchAdapters?: SearchAdapters
}

function fromHubConfig(hub: HubConfig): ResolvedAssembly {
  const assembly = hub.assemblies?.[0]
  if (assembly) {
    return {
      assembly,
      aggregateTextSearchAdapters: hub.aggregateTextSearchAdapters,
    }
  } else {
    throw new Error('hub config has no assemblies')
  }
}

async function resolveAssembly(
  input: AssemblyInput,
): Promise<ResolvedAssembly> {
  if (typeof input === 'string') {
    return isSequenceUri(input)
      ? { assembly: makeAssembly({ fastaUri: input }) }
      : fromHubConfig(await fetchHub(input))
  } else if ('assemblies' in input) {
    return fromHubConfig(input)
  } else {
    return { assembly: input }
  }
}

function mergeSearchAdapters(a: SearchAdapters, b: SearchAdapters) {
  const merged = [...(a ?? []), ...(b ?? [])]
  return merged.length ? merged : undefined
}

// register a track config only if the session can't already resolve it — then
// show it. The guard matters: addTrackConf only dedupes against sessionTracks,
// so re-adding a config already seeded into the config catalog (createViewState
// `tracks`) would push a duplicate into sessionTracks that then shadows the
// catalog entry. getTrackById resolves catalog + connection + session tracks,
// so this is idempotent on mount and on every later setTracks.
function openTrack(session: ViewModel['session'], conf: Tracks[number]) {
  if (!session.getTrackById(conf.trackId)) {
    session.addTrackConf(conf)
  }
  session.view.showTrack(conf.trackId)
}

// open every wanted track and close any others the view is currently showing
function reconcileTracks(viewState: ViewModel, tracks: Tracks) {
  const { session } = viewState
  const { view } = session
  const wanted = new Set(tracks.map(t => t.trackId))
  for (const conf of tracks) {
    openTrack(session, conf)
  }
  // materialize the ids first: hideTrack splices view.tracks, so iterating it
  // live would skip entries
  const unwanted = view.tracks
    .map(track => track.configuration.trackId)
    .filter(trackId => !wanted.has(trackId))
  for (const trackId of unwanted) {
    view.hideTrack(trackId)
  }
}

/**
 * Mount a JBrowse linear genome view imperatively into a DOM element and drive
 * it through a small controller. This is the framework-agnostic primitive every
 * non-React host (anywidget, htmlwidgets, vanilla JS, Observable, ...) wraps:
 * events flow out through `onLocationChange`/`onFeatureSelect`, mutations flow in
 * through the returned methods, and the controller owns the whole lifecycle
 * (async assembly resolution, rebuilds, teardown).
 */
export function createLinearGenomeView(
  el: HTMLElement,
  opts: CreateLinearGenomeViewOptions,
): LinearGenomeViewController {
  const { onLocationChange, onFeatureSelect } = opts

  // desired state, kept across rebuilds and (re)applied at build time so calls
  // made before the async build resolves still land
  let assemblyInput = opts.assembly
  let tracks: TrackInput[] = opts.tracks ?? []
  let defaultSession = opts.defaultSession
  let location = opts.location
  // the resolved assembly name, stamped onto tracks guessed from a bare URL
  let assemblyName: string | undefined

  const root = createRoot(el)
  let disposers: (() => void)[] = []
  let current: ViewModel | undefined

  function teardown() {
    for (const dispose of disposers) {
      dispose()
    }
    disposers = []
  }

  async function build() {
    teardown()
    current = undefined
    const resolved = await resolveAssembly(assemblyInput)
    assemblyName =
      typeof resolved.assembly.name === 'string'
        ? resolved.assembly.name
        : undefined
    const hasSession = defaultSession !== undefined
    const viewState = createViewState({
      assembly: resolved.assembly,
      // only full configs seed the config catalog; loose specs need the
      // pluginManager the build creates, so they are resolved just below
      tracks: tracks
        .filter((track): track is TrackConf => !isLooseTrack(track))
        .map(track => withAssemblyName(track, assemblyName)),
      aggregateTextSearchAdapters: mergeSearchAdapters(
        resolved.aggregateTextSearchAdapters,
        opts.aggregateTextSearchAdapters,
      ),
      internetAccounts: opts.internetAccounts,
      plugins: opts.plugins,
      makeWorkerInstance: opts.makeWorkerInstance,
      configuration: opts.configuration,
      defaultSession,
      // a defaultSession already positions the view; only route location
      // through createViewState's init flow (spinner while loading) otherwise
      location: hasSession ? undefined : location,
    })
    const { session } = viewState
    const { view } = session
    // a defaultSession owns the initial track layout; without one, open the
    // configured tracks so they actually display
    if (!hasSession) {
      reconcileTracks(viewState, resolveTracks(tracks, viewState, assemblyName))
    }
    if (onLocationChange) {
      disposers.push(
        autorun(() => {
          const locs = view.coarseVisibleLocStrings
          if (locs) {
            onLocationChange(locs)
          }
        }),
      )
    }
    if (onFeatureSelect) {
      disposers.push(
        autorun(() => {
          const { selection } = session
          if (isFeature(selection)) {
            onFeatureSelect(selection.toJSON())
          }
        }),
      )
    }
    current = viewState
    root.render(createElement(JBrowseLinearGenomeView, { viewState }))
    return viewState
  }

  let ready = build()
  ready.catch((e: unknown) => {
    console.error(e)
  })

  function rebuild() {
    ready = build()
    ready.catch((e: unknown) => {
      console.error(e)
    })
  }

  return {
    get viewState() {
      return current
    },
    whenReady() {
      return ready
    },
    async setLocation(loc) {
      location = loc
      const view = current?.session.view
      // navToLocString no-ops cleanly when already at loc (MST skips identical
      // offsetPx/bpPerPx writes), so no guard against the current position is
      // needed — and the previous coarseVisibleLocStrings comparison never
      // matched anyway (formatted "ctgA:1..100" vs a raw "ctgA:1-100"/gene input)
      if (view && loc) {
        await view.navToLocString(loc)
      }
    },
    setAssembly(assembly) {
      assemblyInput = assembly
      rebuild()
    },
    setSession(session) {
      defaultSession = session
      rebuild()
    },
    setTracks(next) {
      tracks = next
      if (current) {
        reconcileTracks(current, resolveTracks(next, current, assemblyName))
      }
    },
    addTrack(track) {
      tracks = [...tracks, track]
      if (current) {
        const [conf] = resolveTracks([track], current, assemblyName)
        openTrack(current.session, conf)
      }
    },
    removeTrack(trackId) {
      // loose specs have no trackId until resolved; a full config matching the
      // id is dropped, hideTrack closes it in the view regardless
      tracks = tracks.filter(t => isLooseTrack(t) || t.trackId !== trackId)
      current?.session.view.hideTrack(trackId)
    },
    destroy() {
      teardown()
      root.unmount()
    },
  }
}
