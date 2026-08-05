import { useImperativeHandle, useState } from 'react'

import JBrowseApp from '../JBrowseApp/index.ts'
import { createViewStateFromProps } from '../createViewStateFromProps.ts'

import type { ViewModel } from '../createModel.ts'
import type { CreateViewStateOptions } from '../createViewState.ts'
import type { Config, PluginInput, SessionSnapshot } from '../types.ts'
import type { IJsonPatch } from '@jbrowse/mobx-state-tree'
import type { Ref } from 'react'

// one view to open at launch. `init` is the view-type-specific launch blob
// (LinearGenomeView's InitState, CircularViewInit, synteny's, ...), so across
// the heterogeneous view list it is an open shape rather than one fixed type.
// Most views take an object, but BreakpointSplitView takes an array of
// per-panel init objects instead
export interface ManagedView {
  type: string
  init?: Record<string, unknown> | unknown[]
  id?: string
}

export interface JBrowseProps {
  assemblies: Config['assemblies']
  tracks?: Config['tracks']
  connections?: Config['connections']
  internetAccounts?: Config['internetAccounts']
  aggregateTextSearchAdapters?: Config['aggregateTextSearchAdapters']
  configuration?: Config['configuration']
  plugins?: PluginInput[]
  makeWorkerInstance?: () => Worker
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
  // called when the plugin set changes (the plugin store, addSessionPlugin).
  // Hands back the plugins to load and the session to restore, so the host can
  // loadPlugins + remount; without it the change is only reported to the user.
  onPluginsUpdated?: CreateViewStateOptions['onPluginsUpdated']

  // declarative description of the session to open: the views to show, each
  // with its own type and view-type `init` blob. mirrors a config.json's
  // defaultSession.views, so the same shape round-trips through saved sessions
  views?: ManagedView[]
  sessionName?: string
  // a previously serialized session to restore instead — from decodeSession(),
  // or a getSnapshot(viewState.session) you stored yourself. Unlike `views`
  // (a launch description) this carries full state: navigation, open tracks,
  // per-display settings, widgets. `views` still describes what File → New
  // session returns to.
  session?: SessionSnapshot
  // your own controls in the app toolbar — a Share button, a link back to your
  // app. Only you know the URL your page is served at, so a link-building
  // button has to be yours; see encodeSession and the session-in-url example
  headerButtons?: React.ReactElement
  // ref to the live engine, for imperative control after launch
  // (session.addView, navToLocString, ...)
  ref?: Ref<ViewModel>
}

/**
 * Uncontrolled, prop-driven wrapper around the `viewState`-based
 * {@link JBrowseApp}. Unlike the single-view products this is session-centric:
 * `views` lists the views to open at launch, each carrying its own view-type
 * `init` blob, or `session` restores a previously serialized one. Props are
 * initial values; the engine is built once (remount via React `key` to swap
 * assemblies/plugins). For imperative control after launch (session.addView,
 * navToLocString, ...) take a `ref` to the live engine.
 *
 * This owns its engine for the lifetime of the page and does not tear it down:
 * the engine is not owned by React, so unmounting leaves its RPC worker threads
 * and autoruns running. That is fine for a page that mounts one and keeps it,
 * and a leak for a host that mounts and discards repeatedly — an SPA route, a
 * notebook cell re-run. Those should build the engine themselves
 * ({@link useCreateViewState} + `<JBrowseApp>`, or `createApp`) and hand it to
 * `destroyViewState` when they let go of it.
 */
function JBrowse({ ref, headerButtons, ...opts }: JBrowseProps) {
  const [state] = useState(() => createViewStateFromProps(opts))

  useImperativeHandle(ref, () => state, [state])

  return <JBrowseApp viewState={state} headerButtons={headerButtons} />
}

export default JBrowse
