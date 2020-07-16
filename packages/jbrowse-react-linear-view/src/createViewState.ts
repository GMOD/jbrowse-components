import { PluginConstructor } from '@gmod/jbrowse-core/Plugin'
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
  defaultSession: SessionSnapshot
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
}

export default function createViewState(opts: ViewStateOptions) {
  const {
    assembly,
    tracks,
    configuration,
    plugins,
    location,
    defaultSession,
    onChange,
  } = opts
  const model = createModel(plugins || [])
  const stateSnapshot = {
    config: {
      configuration: {
        ...configuration,
        rpc: { defaultDriver: 'MainThreadRpcDriver' },
      },
      assembly,
      tracks,
      defaultSession,
    },
    assemblyManager: {},
    session: defaultSession,
  }
  const stateTree = model.create(stateSnapshot)
  if (location) {
    autorun(reaction => {
      if (
        stateTree.assemblyManager.allPossibleRefNames &&
        stateTree.assemblyManager.allPossibleRefNames.length
      ) {
        if (typeof location === 'string') {
          stateTree.session.view.navToLocString(location)
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
  return stateTree
}
