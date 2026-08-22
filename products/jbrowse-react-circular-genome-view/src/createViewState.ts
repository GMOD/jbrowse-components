import { expandAssemblyShorthand } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
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
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { CircularViewInit } from '@jbrowse/plugin-circular-view'
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
  /**
   * In-memory files, `name -> bytes`, that `tracks` may then refer to by that
   * name as if it were a URL — for a host whose data lives in a process rather
   * than at a URL (a notebook kernel, an R session), with no web server and no
   * CORS. They are read by byte range, so register an index under its
   * conventional sibling name (`sv.vcf.gz` + `sv.vcf.gz.tbi`) and the file
   * stays indexed: only the bytes the current view needs are touched.
   *
   * Read once, at construction, like every other option here. A host whose
   * files arrive later remounts on a React `key`; the imperative
   * `createCircularGenomeView` has `addLocalFiles` for that instead.
   */
  localFiles?: LocalFileInput
  /**
   * The declarative description of the ring to open — which chromosomes it is
   * drawn from, which tracks to show — minus `assembly`, which is filled in
   * from the `assembly` option so you never repeat it. The same blob a saved
   * session and a URL spec carry, so all three round-trip through each other.
   *
   * Shared by both entry points rather than being the managed component's own
   * input, and that is the point: a host holding its own engine says
   * `init: { displayedRegionNames: [...] }` instead of authoring a
   * `defaultSession` around the same two fields, so choosing
   * `useCreateViewState` over `<CircularGenomeView>` costs nothing.
   *
   * Optional, and `{}` is the same as leaving it off: the configured assembly
   * is drawn either way, so this is how you restrict the ring or name tracks to
   * open with it, not how you ask for the genome.
   */
  init?: Omit<CircularViewInit, 'assembly'>
}

// the imperative call adds the two session slots, plus a shorthand for the one
// init field a host reaches for; the managed component expresses the same
// through `init` alone
export interface ViewStateOptions extends CreateViewStateBaseOptions {
  /** sugar for `init.displayedRegionNames`. Wins over it */
  displayedRegionNames?: string[]
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
 * Build the engine. Asynchronous because CircularView's state model is lazily
 * registered and must be loaded before the session model can embed it — await
 * this once at startup (or use the `useCreateViewState` hook / the
 * `<CircularGenomeView>` component, which handle it).
 */
export default async function createViewState(
  opts: ViewStateOptions,
): Promise<ViewModel> {
  const {
    assembly,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    plugins = [],
    makeWorkerInstance,
    init,
    displayedRegionNames,
    localFiles,
  } = opts
  const { model, pluginManager } = await createModel(
    plugins,
    makeWorkerInstance,
  )
  // A session carries the displays that were open when it was saved, and a
  // display's state model is a dynamic import until something asks for it —
  // createModel only resolves the view type its session model embeds.
  await pluginManager.preloadSessionTypes(opts.defaultSession)
  await pluginManager.preloadSessionTypes(opts.session)
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
  // Route every declarative launch through the view's own `init` field — the
  // same path URL and session-spec launches take — instead of a bespoke
  // setDisplayedRegions/showTrack sequence here. The view's init autorun sets
  // displayedRegions once the assembly loads, then clears init.
  //
  // The last clause is the circular view's own default: a view with no
  // displayedRegions is showing its import form, and `init` is the only thing
  // that can build the figure, so a session that specifies neither gets one
  // seeded from the configured assembly. A session that already has regions is
  // left alone unless the caller asked for something.
  const positioned = view.displayedRegions.length > 0 || view.init !== undefined
  if (init !== undefined || displayedRegionNames !== undefined || !positioned) {
    view.setInit({
      ...init,
      assembly: assembly.name,
      displayedRegionNames: displayedRegionNames ?? init?.displayedRegionNames,
    })
  }
  return stateTree
}
