import { onPatch } from '@jbrowse/mobx-state-tree'

import createModel from './createModel.ts'

import type { PluginsUpdate } from './rootModel/rootModel.ts'
import type { Config, PluginInput, SessionSnapshot } from './types.ts'
import type { IJsonPatch } from '@jbrowse/mobx-state-tree'

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
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
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

export default function createViewState(opts: CreateViewStateOptions) {
  const {
    config,
    plugins = [],
    session,
    onChange,
    onPluginsUpdated,
    makeWorkerInstance,
  } = opts
  const { defaultSession = { name: 'NewSession' } } = config
  const { model, pluginManager } = createModel({
    runtimePlugins: plugins,
    makeWorkerInstance,
  })
  const stateTree = model.create(
    {
      jbrowse: config,
      session: session ?? defaultSession,
    },
    { pluginManager },
  )

  pluginManager.setRootModel(stateTree)
  pluginManager.configure()

  if (onPluginsUpdated) {
    stateTree.setPluginsUpdatedCallback(onPluginsUpdated)
  }

  // A jbrowse-web config.json names its plugins in `config.plugins`, and that
  // app fetches them itself. This one can't: fetching is async and this
  // function is synchronous, so the host has to await loadPlugins and pass the
  // result in. Silently opening a session whose plugins are all missing is the
  // worst outcome — every track that needed one then fails on its own, far from
  // the cause — so say it here instead.
  if (config.plugins?.length && plugins.length === 0) {
    console.warn(
      `This config names ${config.plugins.length} plugin(s), which createViewState does not fetch. Load them yourself: const plugins = await loadPlugins(config.plugins); createViewState({ config, plugins })`,
    )
  }

  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
