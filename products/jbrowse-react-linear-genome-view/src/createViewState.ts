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
  defaultTracks?: string[]
  forceTracks?: string[]
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
}

export default function createViewState({
  assembly,
  tracks,
  configuration,
  aggregateTextSearchAdapters,
  location,
  onChange,
  defaultTracks,
  forceTracks,
  plugins = [],
  defaultSession = {
    name: 'this session',
    view: {
      id: 'linearGenomeView',
      type: 'LinearGenomeView',
    },
  },
}: ViewStateOptions) {
  const { model, pluginManager } = createModel(plugins)
  const stateTree = model.create(
    {
      config: {
        configuration,
        assembly,
        tracks,
        aggregateTextSearchAdapters,
      },
      assemblyManager: {},
      session: defaultSession,
    },
    { pluginManager },
  )

  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
  if (location) {
    autorun(reaction => {
      if (stateTree.session.view.initialized) {
        if (typeof location === 'string') {
          const assemblyName = stateTree.assemblyManager.assemblies[0].name
          stateTree.session.view.navToLocString(location, assemblyName)
        } else {
          stateTree.session.view.navTo(location)
        }
        reaction.dispose()
      }
    })
  }
  if (onChange) {
    onPatch(stateTree, onChange)
  }

  forceTracks?.forEach(track => {
    stateTree.session.view.showTrack(track)
  })

  if (!defaultSession.view?.tracks?.length) {
    defaultTracks?.forEach(track => {
      stateTree.session.view.showTrack(track)
    })
  }
  return stateTree
}
