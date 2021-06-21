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
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
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
  } = opts
  const { model, pluginManager } = createModel(plugins || [])
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
  const stateSnapshot = {
    config: {
      configuration,
      assembly,
      tracks,
      aggregateTextSearchAdapters,
      defaultSession,
    },
    assemblyManager: {},
    session: defaultSession,
  }
  const stateTree = model.create(stateSnapshot, { pluginManager })
  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
  if (location) {
    autorun(reaction => {
      if (
        stateTree.assemblyManager.allPossibleRefNames &&
        stateTree.assemblyManager.allPossibleRefNames.length
      ) {
        if (stateTree.session.view.initialized) {
          if (typeof location === 'string') {
            const assemblyName = stateTree.assemblyManager.assemblies[0].name
            stateTree.session.view.navToLocString(location, assemblyName)
          } else {
            stateTree.session.view.navTo(location)
          }
          reaction.dispose()
        }
      }
    })
  }
  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
