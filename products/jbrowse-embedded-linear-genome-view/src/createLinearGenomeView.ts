import { createElement } from 'react'

import { isFeature } from '@jbrowse/core/util'
import {
  JBrowseLinearGenomeView,
  createViewState,
} from '@jbrowse/react-linear-genome-view2'
import { autorun } from 'mobx'
import { createRoot } from 'react-dom/client'

import { fetchHub } from './fetchHub.ts'

import type { HubConfig } from './fetchHub.ts'
import type {
  ViewModel,
  ViewStateOptions,
} from '@jbrowse/react-linear-genome-view2'

type Tracks = NonNullable<ViewStateOptions['tracks']>
type TrackConf = Tracks[number]
type AssemblyConfig = Record<string, unknown>
type SearchAdapters = ViewStateOptions['aggregateTextSearchAdapters']
type SessionSnapshot = ViewStateOptions['defaultSession']

/**
 * The three shapes an assembly can take: a hub name (`'hg38'`, `'GCF_...'`) that
 * is fetched from jbrowse.org, a full hub config (as `fetchHub` returns), or a
 * bare assembly config (e.g. from `makeAssembly`) — the latter two both being
 * plain config objects, discriminated at resolve time.
 */
export type AssemblyInput = string | AssemblyConfig

export interface CreateLinearGenomeViewOptions {
  assembly: AssemblyInput
  /** track configs to open; a `defaultSession` owns display instead when given */
  tracks?: Tracks
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
  setSession(defaultSession: SessionSnapshot): void
  setTracks(tracks: Tracks): void
  addTrack(track: TrackConf): void
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
    return fromHubConfig(await fetchHub(input))
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

// open every wanted track and close any others the view is currently showing;
// showTrack/addTrackConf dedupe by trackId, so this is safe on mount and on
// every later setTracks
function reconcileTracks(viewState: ViewModel, tracks: Tracks) {
  const { session } = viewState
  const { view } = session
  const wanted = new Set(tracks.map(t => t.trackId))
  for (const conf of tracks) {
    session.addTrackConf(conf)
    view.showTrack(conf.trackId)
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
  let tracks = opts.tracks ?? []
  let defaultSession = opts.defaultSession
  let location = opts.location

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
    const hasSession = defaultSession !== undefined
    const viewState = createViewState({
      assembly: resolved.assembly,
      tracks,
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
      reconcileTracks(viewState, tracks)
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
      if (view && loc && view.coarseVisibleLocStrings !== loc) {
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
        reconcileTracks(current, next)
      }
    },
    addTrack(track) {
      tracks = [...tracks, track]
      if (current) {
        current.session.addTrackConf(track)
        current.session.view.showTrack(track.trackId)
      }
    },
    removeTrack(trackId) {
      tracks = tracks.filter(t => t.trackId !== trackId)
      current?.session.view.hideTrack(trackId)
    },
    destroy() {
      teardown()
      root.unmount()
    },
  }
}
