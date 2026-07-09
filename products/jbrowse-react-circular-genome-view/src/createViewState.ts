import { onPatch } from '@jbrowse/mobx-state-tree'

import createModel from './createModel/index.ts'

import type {
  createConfigModel,
  createSessionModel,
} from './createModel/index.ts'
import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { IJsonPatch, SnapshotIn } from '@jbrowse/mobx-state-tree'

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
  tracks: Tracks
  internetAccounts?: InternetAccounts
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  configuration?: Record<string, unknown>
  plugins?: PluginConstructor[]
  makeWorkerInstance?: () => Worker
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
}

// the imperative API adds a full session snapshot; the managed
// <CircularGenomeView> component expresses initial state through an `init` blob
export interface ViewStateOptions extends CreateViewStateBaseOptions {
  defaultSession?: SessionSnapshot
}

export default function createViewState(opts: ViewStateOptions) {
  const {
    assembly,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    plugins,
    makeWorkerInstance,
    onChange,
  } = opts
  const { model, pluginManager } = createModel(
    plugins ?? [],
    makeWorkerInstance,
  )
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
  for (const account of stateTree.config.internetAccounts) {
    stateTree.addInternetAccount({
      type: account.type,
      configuration: account,
    })
  }
  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
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
  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
