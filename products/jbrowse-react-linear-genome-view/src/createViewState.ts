import { PluginConstructor } from '@jbrowse/core/Plugin'
import { autorun } from 'mobx'
import { SnapshotIn, onPatch, IJsonPatch } from 'mobx-state-tree'
import createModel, {
  createSessionModel,
  createConfigModel,
} from './createModel'

type SessionSnapshot = SnapshotIn<ReturnType<typeof createSessionModel>>
type ConfigSnapshot = SnapshotIn<ReturnType<typeof createConfigModel>>
type Assembly = ConfigSnapshot['assembly']
type Tracks = ConfigSnapshot['tracks']
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
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  configuration?: Record<string, unknown>
  plugins?: PluginConstructor[]
  location?: string | Location
  defaultSession?: SessionSnapshot
  disableAddTracks?: boolean
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
  makeWorkerInstance?: () => Worker
}

export default function createViewState(opts: ViewStateOptions) {
  const {
    assembly,
    tracks,
    configuration,
    aggregateTextSearchAdapters,
    plugins,
    location,
    onChange,
    disableAddTracks = false,
    makeWorkerInstance,
  } = opts
  const { model, pluginManager } = createModel(
    plugins || [],
    makeWorkerInstance,
  )
  let { defaultSession } = opts
  if (!defaultSession) {
    defaultSession = {
      name: 'this session',
      view: {
        id: 'linearGenomeView',
        type: 'LinearGenomeView',
      },
    }
  }
  const stateTree = model.create(
    {
      config: {
        configuration,
        assembly,
        tracks,
        aggregateTextSearchAdapters,
      },
      disableAddTracks,
      session: defaultSession,
    },
    { pluginManager },
  )
  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
  if (location) {
    autorun(async reaction => {
      const { session } = stateTree
      if (!session.view.initialized) {
        return
      }

      if (typeof location === 'string') {
        session.view.navToLocString(location, assembly.name)
      } else {
        session.view.navTo(location)
      }
      reaction.dispose()
    })
  }
  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
