import { assembleLocString } from '@jbrowse/core/util'
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

interface Location {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

interface ViewStateOptions {
  assembly: Assembly
  tracks: Tracks
  internetAccounts?: InternetAccounts
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  configuration?: Record<string, unknown>
  plugins?: PluginConstructor[]
  location?: string | Location
  highlight?: string[]
  defaultSession?: SessionSnapshot
  disableAddTracks?: boolean
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
  makeWorkerInstance?: () => Worker
  drawerViewHeight?: string
}

export default function createViewState(opts: ViewStateOptions) {
  const {
    assembly,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    plugins = [],
    location,
    highlight,
    onChange,
    disableAddTracks = false,
    makeWorkerInstance,
    defaultSession,
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
        name: 'this session',
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
        },
      },
    },
    { pluginManager },
  )
  for (const account of stateTree.config.internetAccounts) {
    const internetAccountType = pluginManager.getInternetAccountType(
      account.type,
    )
    if (!internetAccountType) {
      throw new Error(`unknown internet account type ${account.type}`)
    }
    stateTree.addInternetAccount({
      type: account.type,
      configuration: account,
    })
  }
  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
  if (location) {
    // route through the declarative `init` field so the navigation + highlight
    // flow goes through the same path as URL/session-spec launches, instead of
    // reimplementing navToLocString/addToHighlights here. init also drives the
    // loading-state machine, so the view shows a spinner (not the import form)
    // while the assembly loads
    stateTree.session.view.setInit({
      assembly: assembly.name,
      loc:
        typeof location === 'string' ? location : assembleLocString(location),
      highlight,
    })
  }
  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
