import { assembleLocString } from '@jbrowse/core/util'

import createModel from './createModel/index.ts'

import type {
  createConfigModel,
  createSessionModel,
} from './createModel/index.ts'
import type { ParsedLocString } from '@jbrowse/core/util'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'
import type {
  HighlightType,
  InitState,
} from '@jbrowse/plugin-linear-genome-view'
import type {
  PluginInput,
  SessionSnapshot as RestoredSessionSnapshot,
} from '@jbrowse/product-core'

type SessionSnapshot = SnapshotIn<ReturnType<typeof createSessionModel>>
type ConfigSnapshot = SnapshotIn<ReturnType<typeof createConfigModel>>
type Assembly = ConfigSnapshot['assembly']
type Tracks = ConfigSnapshot['tracks']
type InternetAccounts = ConfigSnapshot['internetAccounts']
type AggregateTextSearchAdapters = ConfigSnapshot['aggregateTextSearchAdapters']

// engine-construction inputs shared by the imperative createViewState and the
// declarative <LinearGenomeView> component
export interface CreateViewStateBaseOptions {
  assembly: Assembly
  tracks?: Tracks
  internetAccounts?: InternetAccounts
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  configuration?: Record<string, unknown>
  /**
   * Plugin classes, or the `{ plugin, definition }` records `loadPlugins`
   * returns — pass those through unchanged, since the definition is what lets
   * the RPC worker load the same plugin on its side.
   */
  plugins?: PluginInput[]
  disableAddTracks?: boolean
  makeWorkerInstance?: () => Worker
  drawerViewHeight?: string
  /**
   * The declarative description of the view to open — where to navigate, which
   * tracks to show, whether to open the track list — minus `assembly`, which is
   * filled in from the `assembly` option so you never repeat it. The same blob
   * a saved session and a URL spec carry, so all three round-trip through each
   * other.
   *
   * Shared by both entry points rather than being the managed component's own
   * input, and that is the point: a host holding its own engine says
   * `init: { loc, tracks: [...] }` instead of authoring a `defaultSession`
   * around the same three fields, so choosing `useCreateViewState` over
   * `<LinearGenomeView>` costs nothing. It is the choice that gets you an
   * engine you can read during render and hand to `destroyViewState`.
   */
  init?: Omit<InitState, 'assembly'>
}

// the imperative call adds the two session slots, plus two shorthands for init
// fields; the managed component expresses the same through `init` alone
export interface ViewStateOptions extends CreateViewStateBaseOptions {
  /** sugar for `init.loc`, and it also accepts a parsed locstring. Wins over `init.loc` */
  location?: string | ParsedLocString
  /** sugar for `init.highlight`. Wins over `init.highlight` */
  highlight?: (string | HighlightType)[]
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

export default function createViewState(opts: ViewStateOptions) {
  const {
    assembly,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    plugins = [],
    init,
    location,
    highlight,
    disableAddTracks = false,
    makeWorkerInstance,
    defaultSession,
    session,
    drawerViewHeight = '100vh',
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
      disableAddTracks,
      drawerViewHeight,
      session: defaultSession ?? {
        name: `New session ${new Date().toLocaleString()}`,
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
        },
      },
    },
    { pluginManager },
  )
  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
  if (session) {
    // applied after create rather than passed in: a restored session's shape is
    // only known at runtime, and restoreSession is the door for that (MST
    // validates it here and throws on a mismatch)
    stateTree.restoreSession(session)
  }
  if (init || location || highlight) {
    // Applied after create rather than folded into the default session above,
    // so one path serves all three inputs and composes with a `defaultSession`
    // the caller authored: the init autorun skips auto-navigation when the
    // session already has displayed regions, so a highlight-only init applies
    // without clobbering that session's own navigation. It is also the same
    // path URL and session-spec launches take, rather than a second
    // navToLocString/addToHighlights/showTrack sequence written here — and it
    // drives the loading-state machine, so the view shows a spinner rather than
    // the import form while the assembly loads.
    stateTree.session.view.setInit({
      ...init,
      assembly: assembly.name,
      loc: location
        ? typeof location === 'string'
          ? location
          : assembleLocString(location)
        : init?.loc,
      highlight: highlight ?? init?.highlight,
    })
  }
  return stateTree
}
