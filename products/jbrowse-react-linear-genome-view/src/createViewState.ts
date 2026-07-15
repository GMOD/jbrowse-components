import { assembleLocString } from '@jbrowse/core/util'
import { onPatch } from '@jbrowse/mobx-state-tree'

import createModel from './createModel/index.ts'

import type {
  createConfigModel,
  createSessionModel,
} from './createModel/index.ts'
import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { ParsedLocString } from '@jbrowse/core/util'
import type { IJsonPatch, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { HighlightType } from '@jbrowse/plugin-linear-genome-view'

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
  tracks: Tracks
  internetAccounts?: InternetAccounts
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  configuration?: Record<string, unknown>
  plugins?: PluginConstructor[]
  disableAddTracks?: boolean
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
  makeWorkerInstance?: () => Worker
  drawerViewHeight?: string
}

// the imperative API adds three ways to express initial state; the managed
// <LinearGenomeView> component expresses the same through a single `init` blob
export interface ViewStateOptions extends CreateViewStateBaseOptions {
  location?: string | ParsedLocString
  highlight?: (string | HighlightType)[]
  defaultSession?: SessionSnapshot
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
  if (location || highlight) {
    // route through the declarative `init` field so the navigation + highlight
    // flow goes through the same path as URL/session-spec launches, instead of
    // reimplementing navToLocString/addToHighlights here. init also drives the
    // loading-state machine, so the view shows a spinner (not the import form)
    // while the assembly loads. a highlight-only call (no location) still routes
    // here; the init autorun skips auto-navigation when a defaultSession already
    // has displayed regions, so highlights apply without clobbering navigation
    stateTree.session.view.setInit({
      assembly: assembly.name,
      loc: location
        ? typeof location === 'string'
          ? location
          : assembleLocString(location)
        : undefined,
      highlight,
    })
  }
  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
