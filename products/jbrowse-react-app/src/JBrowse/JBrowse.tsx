import { useImperativeHandle, useState } from 'react'
import type { Ref } from 'react'

import { observer } from 'mobx-react'

import JBrowseApp from '../JBrowseApp/index.ts'
import createViewState from '../createViewState.ts'

import type { ViewModel } from '../createModel.ts'
import type { Config } from '../types.ts'
import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { IJsonPatch } from '@jbrowse/mobx-state-tree'

// one view to open at launch. `init` is the view-type-specific launch blob
// (LinearGenomeView's InitState, CircularViewInit, synteny's, ...), so across
// the heterogeneous view list it is an open record rather than one fixed shape
export interface ManagedView {
  type: string
  init?: Record<string, unknown>
  id?: string
}

export interface JBrowseProps {
  assemblies: Config['assemblies']
  tracks: Config['tracks']
  internetAccounts?: Config['internetAccounts']
  aggregateTextSearchAdapters?: Config['aggregateTextSearchAdapters']
  configuration?: Config['configuration']
  plugins?: PluginConstructor[]
  makeWorkerInstance?: () => Worker
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void

  // declarative description of the session to open: the views to show, each
  // with its own type and view-type `init` blob. mirrors a config.json's
  // defaultSession.views, so the same shape round-trips through saved sessions
  views?: ManagedView[]
  sessionName?: string
  // ref to the live engine, for imperative control after launch
  // (session.addView, navToLocString, ...)
  ref?: Ref<ViewModel>
}

/**
 * Uncontrolled, prop-driven wrapper around the `viewState`-based
 * {@link JBrowseApp}. Unlike the single-view products this is session-centric:
 * `views` lists the views to open at launch, each carrying its own view-type
 * `init` blob. Props are initial values; the engine is built once (remount via
 * React `key` to swap assemblies/plugins). For imperative control after launch
 * (session.addView, navToLocString, ...) take a `ref` to the live engine.
 */
const JBrowse = observer(function JBrowse({
  assemblies,
  tracks,
  internetAccounts,
  aggregateTextSearchAdapters,
  configuration,
  plugins,
  makeWorkerInstance,
  onChange,
  views,
  sessionName = 'session',
  ref,
}: JBrowseProps) {
  const [state] = useState(() =>
    createViewState({
      config: {
        assemblies,
        tracks,
        internetAccounts,
        aggregateTextSearchAdapters,
        configuration,
        // `views` is the single initial-state mechanism; with none given,
        // createViewState falls back to an empty session
        defaultSession: views?.length
          ? {
              name: sessionName,
              views: views.map((v, i) => ({
                id: v.id ?? `view-${i}`,
                type: v.type,
                init: v.init,
              })),
            }
          : undefined,
      },
      plugins,
      onChange,
      makeWorkerInstance,
    }),
  )

  useImperativeHandle(ref, () => state, [state])

  return <JBrowseApp viewState={state} />
})

export default JBrowse
