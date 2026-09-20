import { expandAssemblyShorthand } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import { assembleLocString } from '@jbrowse/core/util'
import { withPageBaseUri } from '@jbrowse/core/util/addRelativeUris'
import {
  normalizeAdapterSnapshots,
  registerLocalFiles,
  resolveAssembly,
  resolveLocalFileUris,
  withHostOverrides,
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
  LinearGenomeViewLaunchProps,
} from '@jbrowse/plugin-linear-genome-view'
import type {
  LocalFileInput,
  PluginInput,
  SessionSnapshot as RestoredSessionSnapshot,
  RootConfigurationSnapshot,
} from '@jbrowse/product-core'

type SessionSnapshot = SnapshotIn<ReturnType<typeof createSessionModel>>
type ConfigSnapshot = SnapshotIn<ReturnType<typeof createConfigModel>>
type Assembly = NonNullable<ConfigSnapshot['assemblies']>[number]
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
   * The view to open, written flat the way a session spec or a config's view is
   * (ADR-099): where to navigate (`loc`), which tracks to show (`tracks`),
   * `highlight`, `tracklist`, and any of the view's own settings beside them
   * (`hideHeader`, `showGridlines`, `trackLabels`). `type` and `assembly` are
   * filled in.
   *
   * It is the default session's view, so it is read once at create, excludes
   * `defaultSession`, and a restored `session` replaces it.
   */
  view?: Omit<InitState, 'assembly'> & LinearGenomeViewLaunchProps
}

// the imperative call adds the two session slots, plus two shorthands for view
// fields; the managed component expresses the same through `view` alone
export interface ViewStateOptions extends CreateViewStateBaseOptions {
  /** sugar for `view.loc`, and it also accepts a parsed locstring. Wins over `view.loc` */
  location?: string | ParsedLocString
  /** sugar for `view.highlight`. Wins over `view.highlight` */
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

/**
 * `jbrowseHub` in place of `assembly` names a genome hosted at
 * genomes.jbrowse.org (`'hg38'`, `'mm39'`, a GenArk accession) and fetches it:
 * its sequence, refName aliases, track catalog and gene-name search. `tracks`
 * and `aggregateTextSearchAdapters` add to the hub's and win on a shared id.
 */
export type AsyncViewStateOptions =
  | (ViewStateOptions & { jbrowseHub?: never })
  | (Omit<ViewStateOptions, 'assembly'> & {
      jbrowseHub: string
      assembly?: never
    })

async function resolveJBrowseHub(
  opts: AsyncViewStateOptions,
): Promise<ViewStateOptions> {
  if (!('jbrowseHub' in opts)) {
    return opts
  }
  if ('assembly' in opts) {
    throw new Error('pass assembly or jbrowseHub, not both')
  }
  const { jbrowseHub, ...rest } = opts
  const hub = await resolveAssembly(jbrowseHub)
  return {
    ...rest,
    assembly: hub.assembly,
    tracks: withHostOverrides(hub.tracks, rest.tracks ?? [], 'trackId'),
    aggregateTextSearchAdapters: withHostOverrides(
      hub.aggregateTextSearchAdapters,
      rest.aggregateTextSearchAdapters,
      'textSearchAdapterId',
    ),
  }
}

export default function createViewState(opts: ViewStateOptions): ViewModel {
  if ('jbrowseHub' in opts) {
    throw new Error(
      'jbrowseHub is fetched, so it needs useCreateViewState or createViewStateAsync',
    )
  }
  const { plugins = [], makeWorkerInstance } = opts
  const { model, pluginManager } = createModel(plugins, makeWorkerInstance)
  return finishCreateViewState(opts, model, pluginManager)
}

/**
 * `createViewState` for a session naming lazily registered display types:
 * preloads their state models. The synchronous `createViewState` throws on
 * one — a session restored from a URL is the usual case.
 */
export async function createViewStateAsync(input: AsyncViewStateOptions) {
  const opts = await resolveJBrowseHub(input)
  const { plugins = [], makeWorkerInstance } = opts
  const { model, pluginManager } = createModel(plugins, makeWorkerInstance)
  // both: the tree is created from `defaultSession` and a restored `session`
  // is applied afterwards
  await pluginManager.preloadSessionTypes(opts.defaultSession)
  await pluginManager.preloadSessionTypes(opts.session)
  return finishCreateViewState(opts, model, pluginManager)
}

function finishCreateViewState(
  opts: ViewStateOptions,
  model: ReturnType<typeof createModel>['model'],
  pluginManager: ReturnType<typeof createModel>['pluginManager'],
): ViewModel {
  const {
    assembly,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    view,
    location,
    highlight,
    disableAddTracks = false,
    menuBar = false,
    defaultSession,
    session,
    localFiles,
    height,
    drawerViewHeight = '100vh',
  } = opts
  if (view && defaultSession) {
    throw new Error(
      "pass view or defaultSession, not both: view is the default session's view",
    )
  }
  const loc =
    location === undefined || typeof location === 'string'
      ? location
      : assembleLocString(location)
  // the view's own preprocessor sorts these into what it navigates by and what
  // it restores (ADR-099), and an engine given none of them keeps its import
  // form
  const launch =
    view || loc || highlight
      ? {
          ...view,
          assembly: assembly.name,
          loc: loc ?? view?.loc,
          highlight: highlight ?? view?.highlight,
        }
      : undefined
  // registered once, here, rather than per track: each registration pushes a
  // File into core's process-global blobMap. Adapters are expanded out of their
  // `{ type, uri }` shorthand first, because that is the form the substitution
  // recognizes — see normalizeAdapterSnapshots
  const blobs = localFiles ? registerLocalFiles(localFiles) : undefined
  // a declaration rather than a generic arrow: `<T>(x: T) => …` in a .ts file
  // is a JSX tag to babel, which is what jest parses these with
  function local<T>(node: T) {
    return withPageBaseUri(
      blobs
        ? resolveLocalFileUris(
            normalizeAdapterSnapshots(node, pluginManager),
            blobs,
          )
        : node,
    )
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
        assemblies: [local(expandAssemblyShorthand(assembly, pluginManager))],
        tracks: tracks?.map(local),
        internetAccounts,
        aggregateTextSearchAdapters: withPageBaseUri(
          aggregateTextSearchAdapters,
        ),
      },
      disableAddTracks,
      menuBar,
      height,
      drawerViewHeight,
      session: withPageBaseUri(defaultSession) ?? {
        name: `New session ${new Date().toLocaleString()}`,
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
          ...launch,
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
    stateTree.restoreSession(withPageBaseUri(session))
  }
  if ((defaultSession || session) && (loc || highlight)) {
    // the caller's own session is in place, so the two shorthands go through
    // the view's launch rather than its snapshot: the launch autorun skips
    // navigation where the session already has regions, so a highlight alone
    // does not move it
    stateTree.session.view.setLaunch({
      assembly: assembly.name,
      loc,
      highlight,
    })
  }
  return stateTree
}
