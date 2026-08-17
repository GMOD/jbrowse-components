import createModel from './createModel/index.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type {
  createConfigModel,
  createSessionModel,
} from './createModel/index.ts'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'
import type {
  PluginInput,
  SessionSnapshot as RestoredSessionSnapshot,
  RootConfigurationSnapshot,
} from '@jbrowse/product-core'

type SessionSnapshot = SnapshotIn<ReturnType<typeof createSessionModel>>
type ConfigSnapshot = SnapshotIn<ReturnType<typeof createConfigModel>>
type Assembly = ConfigSnapshot['assembly']
type Tracks = ConfigSnapshot['tracks']
type InternetAccounts = ConfigSnapshot['internetAccounts']
type AggregateTextSearchAdapters = ConfigSnapshot['aggregateTextSearchAdapters']

// engine-construction inputs shared by the imperative createViewState and the
// declarative <CircularGenomeView> component
export interface CreateViewStateBaseOptions {
  assembly: Assembly
  tracks?: Tracks
  internetAccounts?: InternetAccounts
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  /**
   * The root config schema's slots — `preferences`, `theme`, `rpc`,
   * `formatDetails`. The declarative half of the engine's settings, and where a
   * host puts something it would otherwise reach into the view to set after
   * construction.
   *
   * Typed off the config model rather than left open: JBrowse drops a config
   * key it does not declare without a word, so a misspelling here is a setting
   * that silently never applies.
   */
  configuration?: RootConfigurationSnapshot
  /**
   * Plugin classes, or the `{ plugin, definition }` records `loadPlugins`
   * returns — pass those through unchanged, since the definition is what lets
   * the RPC worker load the same plugin on its side.
   */
  plugins?: PluginInput[]
  makeWorkerInstance?: () => Worker
}

// the imperative API adds a full session snapshot; the managed
// <CircularGenomeView> component expresses initial state through an `init` blob
export interface ViewStateOptions extends CreateViewStateBaseOptions {
  /** a session you author, checked against the session model's shape */
  defaultSession?: SessionSnapshot
  /**
   * A session that came from somewhere else — {@link decodeSession} on a URL
   * param, a snapshot you stored. Same slot as `defaultSession` (this one
   * wins), but open-shaped: its contents are only known at runtime, so MST
   * validates it at create rather than the compiler validating it here.
   */
  session?: RestoredSessionSnapshot
}

export default function createViewState(opts: ViewStateOptions): ViewModel {
  const {
    assembly,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    plugins = [],
    makeWorkerInstance,
  } = opts
  const { model, pluginManager } = createModel(plugins, makeWorkerInstance)
  const stateTree = model.create(
    {
      config: {
        configuration,
        assembly,
        tracks,
        internetAccounts,
        aggregateTextSearchAdapters,
      },
      session: opts.defaultSession ?? {
        name: `New session ${new Date().toLocaleString()}`,
        view: {
          id: 'circularView',
          type: 'CircularView',
        },
      },
    },
    { pluginManager },
  )
  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
  if (opts.session) {
    // applied after create rather than passed in: a restored session's shape is
    // only known at runtime, and restoreSession is the door for that (MST
    // validates it here and throws on a mismatch)
    stateTree.restoreSession(opts.session)
  }
  const { view } = stateTree.session
  if (!view.displayedRegions.length && !view.init) {
    // a session that specifies neither regions to draw nor an `init` blob
    // (e.g. the default whole-genome case) auto-displays the configured
    // assembly. route it through the view's own `init` field — the same path
    // as URL/session-spec launches — instead of a bespoke autorun here. the
    // view's init autorun sets displayedRegions once the assembly loads, then
    // clears init. a session that already has displayedRegions is left as-is
    view.setInit({ assembly: assembly.name })
  }
  return stateTree
}
