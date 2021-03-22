import { PluginConstructor } from '@jbrowse/core/Plugin'
import { autorun } from 'mobx'
import { SnapshotIn, onPatch, IJsonPatch, getSnapshot } from 'mobx-state-tree'
import createModel, {
  createSessionModel,
  createConfigModel,
} from './createModel'

type SessionSnapshot = SnapshotIn<ReturnType<typeof createSessionModel>>
type ConfigSnapshot = SnapshotIn<ReturnType<typeof createConfigModel>>
type Assembly = ConfigSnapshot['assembly']
type Tracks = ConfigSnapshot['tracks']

interface Location {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

interface ViewStateOptions {
  assembly: Assembly
  tracks: Tracks
  configuration?: Record<string, unknown>
  plugins?: PluginConstructor[]
  location?: string | Location
  defaultSession?: SessionSnapshot
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
}

export default function createViewState(opts: ViewStateOptions) {
  const { assembly, tracks, configuration, plugins, location, onChange } = opts
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
          if (!stateTree.session.view.displayedRegions.length) {
            const assemblyState = stateTree.assemblyManager.assemblies[0]
            const region =
              assemblyState && assemblyState.regions && assemblyState.regions[0]
            if (region) {
              stateTree.session.view.setDisplayedRegions([getSnapshot(region)])
            }
          }
          if (typeof location === 'string') {
            stateTree.session.view.navToLocString(location)
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
