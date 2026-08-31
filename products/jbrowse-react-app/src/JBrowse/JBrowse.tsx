import { useImperativeHandle } from 'react'

import { useCreateOnce } from '@jbrowse/product-core'

import JBrowseApp from '../JBrowseApp/index.ts'
import { createViewStateFromProps } from '../createViewStateFromProps.ts'

import type { ViewModel } from '../createModel.ts'
import type { CreateViewStateOptions } from '../createViewState.ts'
import type { Config, PluginInput, SessionSnapshot } from '../types.ts'
import type { LocalFileInput } from '@jbrowse/product-core'
import type { Ref } from 'react'

/**
 * One view to open at launch. `type` picks the view type and every setting is
 * written directly beside it — a LinearGenomeView's `assembly`/`loc`/`tracks`,
 * a LinearSyntenyView's or BreakpointSplitView's `views`, and any persisted
 * property of that view type. The same object a `config.json`'s
 * `defaultSession.views` entry takes.
 *
 * Open-shaped because the list is heterogeneous and a host may open a view type
 * from its own plugin: what a key means is the view type's business, and an
 * unrecognized one is reported at runtime by the view it was written on.
 */
export interface ManagedView {
  type: string
  id?: string
  /**
   * @deprecated nest nothing: write every setting directly on the view object.
   * Accepted for now, with a warning from the view it opens.
   */
  init?: Record<string, unknown> | unknown[]
  [key: string]: unknown
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
  // with its type and its settings written directly on it. mirrors a
  // config.json's defaultSession.views, so the same shape round-trips through
  // saved sessions
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
 * `views` lists the views to open at launch, each with its settings written
 * directly on it, or `session` restores a previously serialized one. Props are
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
  // `useCreateOnce`, not `useState(() => …)`: StrictMode double-invokes a state
  // initializer and discards the second result, which for an engine is a whole
  // orphaned worker pool per mount, and this component never destroys anything.
  const state = useCreateOnce(() => createViewStateFromProps(opts))

  useImperativeHandle(ref, () => state, [state])

  return <JBrowseApp viewState={state} headerButtons={headerButtons} />
}

export default JBrowse
