import { expandAssemblyShorthand } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { assembleLocString } from '@jbrowse/core/util'
import {
  normalizeAdapterSnapshots,
  registerLocalFiles,
  resolveLocalFileUris,
} from '@jbrowse/product-core'

import createModel from './createModel/index.ts'

import type { ViewModel } from './createModel/createModel.ts'
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
  LocalFileInput,
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
// declarative <LinearGenomeView> component
export interface CreateViewStateBaseOptions {
  assembly: Assembly
  tracks?: Tracks
  internetAccounts?: InternetAccounts
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  /**
   * The root config schema's slots — `preferences`, `theme`, `rpc`,
   * `formatDetails`. The declarative half of the engine's settings, and the
   * place a host puts something it would otherwise reach into the view to set
   * after construction (`preferences: { scrollZoom: true }` rather than a
   * `view.setScrollZoom(true)` on the next line).
   *
   * Typed off the config model rather than left open: JBrowse drops a slot it
   * does not declare without a word, so a misspelling here is a setting that
   * silently never applies.
   */
  configuration?: RootConfigurationSnapshot
  /**
   * Plugin classes, or the `{ plugin, definition }` records `loadPlugins`
   * returns — pass those through unchanged, since the definition is what lets
   * the RPC worker load the same plugin on its side.
   */
  plugins?: PluginInput[]
  disableAddTracks?: boolean
  /**
   * Draw the app-shaped `File` menu bar above the view, the way
   * `@jbrowse/react-app` has one. Off by default -- an embedded view is the
   * chrome a host asked for and nothing more -- and it carries the two items an
   * embed can honour, **Open track...** and **Open connection...**, so
   * `disableAddTracks` empties it and the bar then draws nothing.
   *
   * It takes a row out of `height` rather than adding to it: a bounded
   * component is `height` tall with the bar inside it.
   */
  menuBar?: boolean
  makeWorkerInstance?: () => Worker
  /**
   * Any CSS height (`'400px'`, `'80vh'`), applied to the component's own root.
   * Without it the component is content-height and grows as tracks are added,
   * which is right for a document and wrong for a panel; a host box with a
   * height of its own also bounds it, and still does.
   *
   * This is also what a drawer widget is tall against, so it supersedes
   * `drawerViewHeight`: one number bounds the view and gives the drawer beside
   * it a definite scroll region.
   */
  height?: string
  /**
   * @deprecated Pass `height` instead. This applied only while a drawer widget
   * was open, which is the same idea under a condition it did not need. Still
   * honored when `height` is absent.
   */
  drawerViewHeight?: string
  /**
   * In-memory files, `name -> bytes`, that `tracks` may then refer to by that
   * name as if it were a URL — for a host whose data lives in a process rather
   * than at a URL (a notebook kernel, an R session), with no web server and no
   * CORS. They are read by byte range, so register an index under its
   * conventional sibling name (`peaks.bed.gz` + `peaks.bed.gz.tbi`) and the
   * file stays indexed: only the bytes the current view needs are touched.
   *
   * Read once, at construction, like every other option here. A host whose
   * files arrive later remounts on a React `key`; the imperative
   * `createLinearGenomeView` has `addLocalFiles` for that instead.
   */
  localFiles?: LocalFileInput
  /**
   * The declarative description of the view to open — where to navigate, which
   * tracks to show, whether to open the track list — minus `assembly`, which is
   * filled in from the `assembly` option so you never repeat it.
   *
   * Read ONCE, at create, the way `defaultValue` is: it seeds the view and is
   * never consulted again, so changing it later moves nothing. That is what the
   * name is for, and it is why this survived v5 removing `init` as a key ON a
   * view — there the word named a second authoring shape for settings that now
   * go directly on the view object (ADR-099), and a saved session or URL spec
   * carries them flat. This is an argument to a factory, not a snapshot key.
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

export default function createViewState(opts: ViewStateOptions): ViewModel {
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
    menuBar = false,
    makeWorkerInstance,
    defaultSession,
    session,
    localFiles,
    height,
    drawerViewHeight = '100vh',
  } = opts
  const { model, pluginManager } = createModel(plugins, makeWorkerInstance)
  // registered once, here, rather than per track: each registration pushes a
  // File into core's process-global blobMap. Adapters are expanded out of their
  // `{ type, uri }` shorthand first, because that is the form the substitution
  // recognizes — see normalizeAdapterSnapshots
  const blobs = localFiles ? registerLocalFiles(localFiles) : undefined
  // a declaration rather than a generic arrow: `<T>(x: T) => …` in a .ts file
  // is a JSX tag to babel, which is what jest parses these with
  function local<T>(node: T) {
    return blobs
      ? resolveLocalFileUris(
          normalizeAdapterSnapshots(node, pluginManager),
          blobs,
        )
      : node
  }
  const stateTree = model.create(
    {
      config: {
        configuration,
        // The assembly too, not only the tracks: its sequence adapter is the
        // same shape, and a host whose genome is a file on disk rather than a
        // hub — a non-model organism, an in-house build — has nowhere to put it.
        //
        // Its own shorthand is expanded first, and by a different door than an
        // adapter's: `{ name, uri: 'genome.fa.gz' }` becomes a sequence adapter
        // inside the *assembly* config schema, so until that has run the only
        // `uri` here is on the assembly itself — which is not a location node
        // and must not be rewritten as one.
        assembly: local(expandAssemblyShorthand(assembly, pluginManager)),
        tracks: tracks?.map(local),
        internetAccounts,
        aggregateTextSearchAdapters,
      },
      disableAddTracks,
      menuBar,
      height,
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
    stateTree.session.view.setLaunch({
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
