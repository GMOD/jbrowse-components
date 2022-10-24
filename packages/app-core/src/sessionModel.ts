import PluginManager from '@jbrowse/core/PluginManager'
import {
  types,
  isAlive,
  IModelType,
  ModelProperties,
  SnapshotOut,
} from 'mobx-state-tree'
import { observable } from 'mobx'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { DialogComponentType } from '@jbrowse/core/util/types'

export declare interface ReactProps {
  [key: string]: any
}

type AnyConfiguration =
  | AnyConfigurationModel
  | SnapshotOut<AnyConfigurationModel>

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
      /**
       * this is the globally "selected" object. can be anything.
       * code that wants to deal with this should examine it to see what
       * kind of thing it is.
       */
      selection: undefined,
      /**
       * this is the current "task" that is being performed in the UI.
       * this is usually an object of the form
       * `{ taskName: "configure", target: thing_being_configured }`
       */
      task: undefined,
      queueOfDialogs: observable.array([] as [DialogComponentType, any][]),
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

      addWidget(
        type: string,
        id: string,
        initialState = {},
        configuration = { type },
      ) {
        const typeDefinition = pm.getElementType('widget', type)
        if (!typeDefinition) {
          throw new Error(`unknown widget type ${type}`)
        }
        self.widgets.set(id, {
          ...initialState,
          id,
          type,
          configuration,
        })
        return self.widgets.get(id)
      },

      showWidget(widget: any) {
        if (self.activeWidgets.has(widget.id)) {
          self.activeWidgets.delete(widget.id)
        }
        self.activeWidgets.set(widget.id, widget)
      },

      hasWidget(widget: any) {
        return self.activeWidgets.has(widget.id)
      },

      hideWidget(widget: any) {
        self.activeWidgets.delete(widget.id)
      },

      hideAllWidgets() {
        self.activeWidgets.clear()
      },

      /**
       * set the global selection, i.e. the globally-selected object.
       * can be a feature, a view, just about anything
       * @param thing -
       */
      setSelection(thing: any) {
        self.selection = thing
      },

      /**
       * clears the global selection
       */
      clearSelection() {
        self.selection = undefined
      },

      clearConnections() {
        self.connectionInstances.length = 0
      },
    }))

    .views(self => ({
      get visibleWidget() {
        if (isAlive(self)) {
          // returns most recently added item in active widgets
          return Array.from(self.activeWidgets.values())[
            self.activeWidgets.size - 1
          ]
        }
        return undefined
      },
      get DialogComponent() {
        if (self.queueOfDialogs.length) {
          return self.queueOfDialogs[0]![0]
        }
        return undefined
      },
      get DialogProps() {
        if (self.queueOfDialogs.length) {
          return self.queueOfDialogs[0]![1]
        }
        return undefined
      },
    }))

  return types.compose(model, newModel)
}

export function addSessionTrack(self: any, trackConf: AnyConfiguration) {
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

export function addAssembly(self: any, list: any, conf: AnyConfiguration) {
  // @ts-ignore
  const asm = list.find(f => f.name === conf.name)
  if (asm) {
    console.warn(`Assembly ${conf.name} was already existing`)
    return asm
  }
  const length = list.push(conf)
  return list[length - 1]
}

export function removeAssembly(self: any, list: any, name: string) {
  // @ts-ignore
  const index = list.findIndex(asm => asm.name === name)
  if (index !== -1) {
    self.sessionAssemblies.splice(index, 1)
  }
}
