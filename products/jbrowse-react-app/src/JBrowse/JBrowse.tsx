import { useImperativeHandle } from 'react'

import { useCreateOnceAsync } from '@jbrowse/product-core'

import JBrowseApp from '../JBrowseApp/index.ts'
import { createViewStateFromPropsAsync } from '../createViewStateFromProps.ts'

import type { ViewModel } from '../createModel.ts'
import type { CreateViewStateOptions } from '../createViewState.ts'
import type { Config, PluginInput, SessionSnapshot } from '../types.ts'
import type { LocalFileInput } from '@jbrowse/product-core'
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
  /**
   * In-memory files, `name -> bytes`, that `tracks` may then refer to by that
   * name as if it were a URL — for a host whose data lives in a process rather
   * than at a URL (a notebook kernel, an R session), with no web server and no
   * CORS. They are read by byte range, so register an index under its
   * conventional sibling name (`peaks.bed.gz` + `peaks.bed.gz.tbi`) and the
   * file stays indexed: only the bytes the current view needs are touched.
   */
  localFiles?: LocalFileInput
  makeWorkerInstance?: () => Worker
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
  // (session.addView, navToLocString, ...). Undefined until the engine is
  // built, which is a wait: the view and display types a session names are
  // loaded first.
  ref?: Ref<ViewModel | undefined>
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
 * notebook cell re-run. Those should use {@link useCreateViewState} +
 * `<JBrowseApp>`, which destroys the engine on unmount, or `createApp`, which
 * owns the whole lifecycle.
 */
function JBrowse({ ref, headerButtons, ...opts }: JBrowseProps) {
  // `useCreateOnceAsync`, not `useState(() => …)`: StrictMode double-invokes a
  // state initializer and discards the second result, which for an engine is a
  // whole orphaned worker pool per mount, and this component never destroys
  // anything. Async because `views`/`session` name view and display types whose
  // state models are loaded on demand — nothing renders for that frame.
  const state = useCreateOnceAsync(() => createViewStateFromPropsAsync(opts))

  useImperativeHandle(ref, () => state, [state])

  return state ? (
    <JBrowseApp viewState={state} headerButtons={headerButtons} />
  ) : null
}

export default JBrowse
