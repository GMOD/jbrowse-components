import PluginManager from '@jbrowse/core/PluginManager'
import { types, IModelType, ModelProperties } from 'mobx-state-tree'
import { observable } from 'mobx'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { DialogComponentType } from '@jbrowse/core/util/types'

export declare interface ReactProps {
  [key: string]: any
}

export default function extend<PROPS extends ModelProperties, OTHERS>(
  model: IModelType<PROPS, OTHERS>,
  pm: PluginManager,
): IModelType<PROPS, OTHERS> {
  const newModel = types
    .model({
      widgets: types.map(pm.pluggableMstType('widget', 'stateModel')),
      activeWidgets: types.map(
        types.safeReference(pm.pluggableMstType('widget', 'stateModel')),
      ),
      connectionInstances: types.array(
        pm.pluggableMstType('connection', 'stateModel'),
      ),
      sessionTracks: types.array(pm.pluggableConfigSchemaType('track')),
    })
    .volatile(() => ({
      queueOfDialogs: observable.array(
        [] as [DialogComponentType, ReactProps][],
      ),
    }))
    .actions(self => ({
      queueDialog(
        callback: (
          doneCallback: () => void,
        ) => [DialogComponentType, ReactProps],
      ): void {
        const [component, props] = callback(() => {
          self.queueOfDialogs.shift()
        })
        self.queueOfDialogs.push([component, props])
      },
    }))

    .views(self => ({
      get DialogComponent() {
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[0]
        }
        return undefined
      },
      get DialogProps() {
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[1]
        }
        return undefined
      },
    }))

  return types.compose(newModel, model)
}

export function addSessionTrack(self: any, trackConf: AnyConfigurationModel) {
  const { trackId, type } = trackConf
  if (!type) {
    throw new Error(`unknown track type ${type}`)
  }
  const track = self.sessionTracks.find((t: any) => t.trackId === trackId)
  if (track) {
    return track
  }
  const length = self.sessionTracks.push(trackConf)
  return self.sessionTracks[length - 1]
}
