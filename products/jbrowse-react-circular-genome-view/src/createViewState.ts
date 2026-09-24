import { expandAssemblyShorthand } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import {
  normalizeAdapterSnapshots,
  registerLocalFiles,
  resolveAssemblies,
  resolveLocalFileUris,
} from '@jbrowse/product-core'

import createModel from './createModel/index.ts'

import type { ViewModel } from './createModel/createModel.ts'
import type {
  createConfigModel,
  createSessionModel,
} from './createModel/index.ts'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'
import type {
  CircularViewCommands,
  CircularViewStateModel,
} from '@jbrowse/plugin-circular-view'
import type {
  LocalFileInput,
  PluginInput,
  SessionSnapshot as RestoredSessionSnapshot,
  RootConfigurationSnapshot,
} from '@jbrowse/product-core'

type SessionSnapshot = SnapshotIn<ReturnType<typeof createSessionModel>>
type CircularViewLaunchProps = Partial<
  Omit<
    SnapshotIn<CircularViewStateModel>,
    keyof CircularViewCommands | 'id' | 'type' | 'launch'
  >
>
type ConfigSnapshot = SnapshotIn<ReturnType<typeof createConfigModel>>
type Assembly = NonNullable<ConfigSnapshot['assemblies']>[number]
type Tracks = ConfigSnapshot['tracks']
type InternetAccounts = ConfigSnapshot['internetAccounts']
type AggregateTextSearchAdapters = ConfigSnapshot['aggregateTextSearchAdapters']

// engine-construction inputs shared by the imperative createViewState and the
// declarative <CircularGenomeView> component
export interface CreateViewStateBaseOptions {
  /**
   * The genome the circle is drawn from, or several, in the order their arcs
   * are laid out. A synteny ribbon plot needs both ends of its alignments on
   * the circle, so `['hg38', 'mm39']`-style pairs are the case the list is for;
   * `assemblyNames` on a track then says which of them the track is on.
   */
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
   * The ring to open, written flat the way a session spec or a config's view is
   * (ADR-099): which chromosomes it is drawn from (`displayedRegionNames`),
   * which tracks to show (`tracks`), `autoDiagonalize`, and any of the view's
   * own settings beside them (`height`). `type` and `assembly` are filled in.
   *
   * It is the default session's view, so it is read once at create, excludes
   * `defaultSession`, and a restored `session` replaces it. Left off, the
   * configured genome is drawn whole.
   */
  view?: Omit<CircularViewCommands, 'assembly'> & CircularViewLaunchProps
}

// the imperative call adds the two session slots, plus a shorthand for the one
// view field a host reaches for; the managed component expresses the same
// through `view` alone
export interface ViewStateOptions extends CreateViewStateBaseOptions {
  /** sugar for `view.displayedRegionNames`. Wins over it */
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
 * `jbrowseHub` in place of `assembly` names one genome hosted at
 * genomes.jbrowse.org, or several (`['hg38', 'mm39']`), and fetches each: its
 * sequence, chromosome sizes, refName aliases and track catalog. `tracks` and
 * `aggregateTextSearchAdapters` add to the hubs' and win on a shared id.
 */
export type AsyncViewStateOptions =
  | (ViewStateOptions & { jbrowseHub?: never })
  | (Omit<ViewStateOptions, 'assembly'> & {
      jbrowseHub: string | string[]
      assembly?: never
    })

async function resolveJBrowseHub(
  opts: AsyncViewStateOptions,
): Promise<ViewStateOptions> {
  if (opts.jbrowseHub === undefined) {
    return opts
  }
  if ('assembly' in opts) {
    throw new Error('pass assembly or jbrowseHub, not both')
  }
  const { jbrowseHub, ...rest } = opts
  const hubs = await resolveAssemblies([jbrowseHub].flat(), {
    tracks: rest.tracks ?? [],
    aggregateTextSearchAdapters: rest.aggregateTextSearchAdapters,
  })
  return {
    ...rest,
    assembly: hubs.assemblies,
    tracks: hubs.tracks,
    aggregateTextSearchAdapters: hubs.aggregateTextSearchAdapters,
  }
}

/**
 * Asynchronous because CircularView's state model is lazily registered and
 * must be loaded before the session model can embed it.
 */
export default async function createViewState(
  input: AsyncViewStateOptions,
): Promise<ViewModel> {
  const opts = await resolveJBrowseHub(input)
  const {
    assembly,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    plugins = [],
    makeWorkerInstance,
    view: authored,
    displayedRegionNames,
    localFiles,
  } = opts
  const assemblies = [assembly].flat()
  if (authored && opts.defaultSession) {
    throw new Error(
      "pass view or defaultSession, not both: view is the default session's view",
    )
  }
  const assemblyNames = assemblies.map(a => a.name)
  // the view's own preprocessor sorts these into what it lays out by and what
  // it restores (ADR-099)
  const launch =
    authored !== undefined || displayedRegionNames !== undefined
      ? {
          ...authored,
          assembly: assemblyNames,
          displayedRegionNames:
            displayedRegionNames ?? authored?.displayedRegionNames,
        }
      : undefined
  const { model, pluginManager } = await createModel(
    plugins,
    makeWorkerInstance,
  )
  // createModel resolves only the view type its session model embeds; the
  // displays a session names are dynamic imports too
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
        // The assemblies too, not only the tracks: a sequence adapter is the
        // same shape, and a host whose genome is a file on disk rather than a
        // hub — a non-model organism, an in-house build — has nowhere to put it.
        //
        // Its own shorthand is expanded first, and by a different door than an
        // adapter's: `{ name, uri: 'genome.fa.gz' }` becomes a sequence adapter
        // inside the *assembly* config schema, so until that has run the only
        // `uri` here is on the assembly itself — which is not a location node
        // and must not be rewritten as one.
        assemblies: assemblies.map(a =>
          local(expandAssemblyShorthand(a, pluginManager)),
        ),
        tracks: tracks?.map(local),
        internetAccounts,
        aggregateTextSearchAdapters,
      },
      session: opts.defaultSession ?? {
        name: `New session ${new Date().toLocaleString()}`,
        view: {
          id: 'circularView',
          type: 'CircularView',
          ...launch,
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
  // Route every declarative launch through the view's own launch blob — the
  // same path URL and session-spec launches take — instead of a bespoke
  // setDisplayedRegions/showTrack sequence here. The launch autorun sets
  // displayedRegions once the assembly loads, then clears the blob.
  //
  // The last clause is the circular view's own default: a view with no
  // displayedRegions is showing its import form, and a pending launch is the
  // only thing that can build the figure, so a session that specifies neither
  // gets one seeded from the configured assembly. A session that already has
  // regions is left alone unless the caller asked for something.
  const positioned =
    view.displayedRegions.length > 0 || view.pendingLaunch !== undefined
  const ownSession = opts.defaultSession ?? opts.session
  if ((ownSession && displayedRegionNames !== undefined) || !positioned) {
    view.setLaunch({ assembly: assemblyNames, displayedRegionNames })
  }
  return stateTree
}
