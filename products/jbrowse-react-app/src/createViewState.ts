import { expandAssemblyShorthand } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import {
  dedupePlugins,
  dropVendoredPlugins,
  pluginLabel,
  pluginsNotIn,
} from '@jbrowse/core/pluginDefinitions'
import {
  normalizeAdapterSnapshots,
  registerLocalFiles,
  resolveLocalFileUris,
} from '@jbrowse/product-core'

import createModel from './createModel.ts'

import type { ViewModel } from './createModel.ts'
import type { PluginsUpdate } from './rootModel/rootModel.ts'
import type {
  Config,
  LocalFileInput,
  PluginInput,
  SessionSnapshot,
} from './types.ts'

export interface CreateViewStateOptions {
  config: Config
  plugins?: PluginInput[]
  /**
   * A serialized session to open now — e.g. one restored from a URL via
   * {@link decodeSession}, or a `getSnapshot(viewState.session)` you stored
   * yourself. It only decides what opens at launch: `config.defaultSession` is
   * left alone, so File → New session still returns to the app's own starting
   * state rather than to whatever was restored.
   */
  session?: SessionSnapshot
  /**
   * In-memory files, `name -> bytes`, that `config.tracks` may then refer to by
   * that name as if it were a URL — for a host whose data lives in a process
   * rather than at a URL (a notebook kernel, an R session), with no web server
   * and no CORS. They are read by byte range, so register an index under its
   * conventional sibling name (`peaks.bed.gz` + `peaks.bed.gz.tbi`) and the
   * file stays indexed: only the bytes the current view needs are touched.
   */
  localFiles?: LocalFileInput
  makeWorkerInstance?: () => Worker
  /**
   * Called when something changes the plugin set — the plugin store widget,
   * `session.addSessionPlugin`. A plugin set can only change by rebuilding the
   * plugin manager, which this app can't do for itself (it never fetches
   * plugins, and it doesn't own the React tree it's mounted into), so it hands
   * you what a rebuild needs: `await loadPlugins(plugins)`, then remount with
   * the new `plugins` and the given `session` so the user lands where they
   * were. Without this, the change is only reported to the user.
   */
  onPluginsUpdated?: (args: PluginsUpdate) => void
}

export default function createViewState(
  opts: CreateViewStateOptions,
): ViewModel {
  const { plugins = [], makeWorkerInstance } = opts
  const { model, pluginManager } = createModel({
    runtimePlugins: plugins,
    makeWorkerInstance,
  })
  return finishCreateViewState(opts, model, pluginManager)
}

/**
 * `createViewState` for a config or session that may name view types whose
 * state models are lazily loaded (registered as loaders): resolves them
 * first. The synchronous `createViewState` requires every view type the
 * session names to be eagerly registered, and throws otherwise.
 */
export async function createViewStateAsync(opts: CreateViewStateOptions) {
  const { plugins = [], makeWorkerInstance } = opts
  const { model, pluginManager } = createModel({
    runtimePlugins: plugins,
    makeWorkerInstance,
  })
  // both, not one or the other: the tree is created with `defaultSession` and a
  // restored `session` is applied to it afterwards, so each one's types have to
  // be there
  await pluginManager.preloadSessionTypes(opts.config.defaultSession)
  await pluginManager.preloadSessionTypes(opts.session)
  return finishCreateViewState(opts, model, pluginManager)
}

function finishCreateViewState(
  opts: CreateViewStateOptions,
  model: ReturnType<typeof createModel>['model'],
  pluginManager: ReturnType<typeof createModel>['pluginManager'],
): ViewModel {
  const { config, session, onPluginsUpdated, localFiles } = opts
  // the config model's own default for this slot, restated because a root with
  // no session at all is a different (broken) state than one with an empty
  // session — `session` is a types.maybe, so passing undefined means "no
  // session", not "the default one"
  const { defaultSession = { name: 'New Session' } } = config
  // what the plugin manager actually installed at runtime, i.e. the subset of
  // `plugins` that carried a definition (a bare plugin class carries none)
  const loaded = pluginManager.runtimePluginDefinitions
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
  // annotated so the reads below are checked: `model` erases its session type
  // (see ViewModel), and a session is always passed here
  const stateTree: ViewModel = model.create(
    {
      jbrowse: {
        ...config,
        tracks: config.tracks?.map(local),
        // The assemblies too, not only the tracks: a sequence adapter is the
        // same shape, and a host whose genome is a file on disk rather than a
        // hub — a non-model organism, an in-house build — has nowhere to put it.
        // Their own shorthand is expanded first, by a different door than an
        // adapter's — see the lgv product's createViewState for why.
        assemblies: config.assemblies.map(a =>
          local(expandAssemblyShorthand(a, pluginManager)),
        ),
        // The plugins the host loaded for us belong in the app's own plugin
        // list, not only in the plugin manager. `onPluginsUpdated` answers
        // "what does a rebuild have to load" out of `jbrowse.plugins`, so a
        // list holding only the config's own entries hands the host back a set
        // missing everything it passed as `plugins` — and remounting on that
        // set silently drops them. <JBrowse>/createApp take no `config.plugins`
        // at all, so for those this is the only place they are written down.
        plugins: dedupePlugins([...(config.plugins ?? []), ...loaded]),
      },
      session: session ?? defaultSession,
    },
    { pluginManager },
  )

  pluginManager.setRootModel(stateTree)
  pluginManager.configure()

  if (onPluginsUpdated) {
    stateTree.setPluginsUpdatedCallback(onPluginsUpdated)
  }

  // A config.json names its plugins in `config.plugins`, and a session that was
  // shared or saved out of jbrowse-web can carry its own in `sessionPlugins`.
  // That app fetches both itself; this one can't, because fetching is async and
  // this function is synchronous, so the host has to await loadPlugins and pass
  // the result in. Silently opening a session whose plugins are missing is the
  // worst outcome — every track that needed one then fails on its own, far from
  // the cause — so name the ones that never arrived.
  //
  // Compared against what was actually loaded rather than "did the host pass
  // anything at all": a host that loads two of the three a config names has the
  // same problem for the third, and used to hear nothing. Vendored names go
  // first, since core already bundles those and `loadPlugins` drops them, so
  // they are never among the loaded definitions.
  const missing = pluginsNotIn(
    dropVendoredPlugins(
      dedupePlugins([
        ...(config.plugins ?? []),
        ...stateTree.session.sessionPlugins,
      ]),
    ),
    loaded,
  )
  if (missing.length > 0) {
    console.warn(
      `This config/session names ${missing.length} plugin(s) that were not passed in, and createViewState does not fetch them: ${missing.map(d => pluginLabel(d)).join(', ')}. Load them yourself: const plugins = await loadPlugins(defs); createViewState({ config, plugins })`,
    )
  }

  return stateTree
}
