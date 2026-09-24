import { createElement } from 'react'

import { createRoot } from 'react-dom/client'

import {
  isLooseTrack,
  reconcileTracks,
  resolveTracks,
  withAssemblyName,
  withHostOverrides,
} from './controllerTracks.ts'
import { destroyViewState } from './destroyViewState.ts'
import {
  mergeLocalFiles,
  registerLocalFiles,
  resolveLocalFileUris,
} from './localFiles.ts'
import { observeSession } from './observeSession.ts'
import { resolveAssembly } from './resolveAssemblies.ts'

import type {
  ControllerSession,
  TrackConf,
  TrackInput,
} from './controllerTracks.ts'
import type { EmbeddedRoot } from './destroyViewState.ts'
import type { LocalFileInput } from './localFiles.ts'
import type { ObservedSession, SessionObservers } from './observeSession.ts'
import type { AssemblyInput, ResolvedAssembly } from './resolveAssemblies.ts'
import type { ComponentType } from 'react'

/** The fields every embedded controller's `update` takes. */
export interface ControllerState {
  tracks?: TrackInput[]
  localFiles?: LocalFileInput
}

interface ControllerRoot extends EmbeddedRoot {
  session: ControllerSession &
    ObservedSession & {
      view: { setLaunch(launch: { assembly: string }): void }
    }
}

export interface EngineSeed<Launch> {
  resolved: ResolvedAssembly
  /** the hub's catalog and the host's full configs, the host's winning an id */
  tracks: TrackConf[]
  /** the view to open, absent when a restored session positions it */
  view: Launch | undefined
}

export interface EmbeddedControllerSpec<VM, State, Launch> {
  assembly: AssemblyInput
  /** a restored session, which owns the initial layout */
  session?: unknown
  state: NoInfer<State>
  observers: SessionObservers
  onError?: (error: unknown) => void
  Component: ComponentType<{ viewState: VM }>
  build: (seed: EngineSeed<Launch>) => Promise<VM>
  /**
   * The view launch `stated` asks for, read off `wanted` and less its
   * assembly, or undefined when `stated` names nothing a launch carries. The
   * build asks with the initial state as both.
   */
  launchFor: (stated: State, wanted: State) => Launch | undefined
}

function restate<T extends object>(wanted: T, stated: T) {
  const next = { ...wanted }
  for (const key of Object.keys(stated) as (keyof T)[]) {
    if (stated[key] !== undefined) {
      next[key] = stated[key]
    }
  }
  return next
}

/**
 * The lifecycle behind each embedded product's imperative controller: resolve
 * the genome, build the engine, open the wanted tracks, mount, then reconcile
 * each `update` and tear everything down on `destroy`. The product supplies
 * the engine and the view launch its own state fields ask for.
 */
export function createEmbeddedController<
  VM extends ControllerRoot,
  State extends ControllerState,
  Launch extends object,
>(el: HTMLElement, spec: EmbeddedControllerSpec<VM, State, Launch>) {
  const {
    Component,
    launchFor,
    onError = (e: unknown) => {
      console.error(e)
    },
  } = spec
  const hasSession = spec.session !== undefined
  let wanted = spec.state
  let localFiles = registerLocalFiles(wanted.localFiles ?? {})
  let assemblyName: string | undefined
  let current: VM | undefined
  let stopObserving: (() => void) | undefined
  let destroyed = false
  const root = createRoot(el)

  function wantedTracks(viewState: VM) {
    return resolveTracks(
      wanted.tracks ?? [],
      viewState.session,
      assemblyName,
      localFiles,
    )
  }

  async function build() {
    const resolved = await resolveAssembly(spec.assembly)
    const { name } = resolved.assembly
    assemblyName = typeof name === 'string' ? name : undefined
    const viewState = await spec.build({
      resolved,
      tracks: withHostOverrides(
        resolved.tracks,
        (wanted.tracks ?? [])
          .filter((track): track is TrackConf => !isLooseTrack(track))
          .map(track =>
            resolveLocalFileUris(
              withAssemblyName(track, assemblyName),
              localFiles,
            ),
          ),
        'trackId',
      ),
      view: hasSession ? undefined : launchFor(wanted, wanted),
    })
    if (!hasSession) {
      await reconcileTracks(viewState.session, wantedTracks(viewState))
    }
    // destroy() can land during any await above, before there was an engine
    // for it to tear down
    if (destroyed) {
      destroyViewState(viewState)
      return viewState
    }
    current = viewState
    stopObserving = observeSession(viewState, spec.observers)
    root.render(createElement(Component, { viewState }))
    return viewState
  }

  const ready = build()
  ready.catch(onError)

  async function apply(stated: State) {
    const viewState = current
    if (!viewState) {
      return
    }
    if (stated.tracks) {
      await reconcileTracks(viewState.session, wantedTracks(viewState))
    }
    const launch = launchFor(stated, wanted)
    if (launch && assemblyName && !destroyed) {
      viewState.session.view.setLaunch({ ...launch, assembly: assemblyName })
    }
  }

  return {
    whenReady() {
      return ready
    },
    async update(stated: State) {
      if (stated.localFiles) {
        localFiles = mergeLocalFiles(localFiles, stated.localFiles)
      }
      wanted = restate(wanted, stated)
      await ready
      await apply(stated)
    },
    destroy() {
      destroyed = true
      stopObserving?.()
      root.unmount()
      if (current) {
        destroyViewState(current)
      }
      current = undefined
    },
  }
}
