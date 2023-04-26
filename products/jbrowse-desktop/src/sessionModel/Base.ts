import PluginManager from '@jbrowse/core/PluginManager'
import { Instance, getParent, types } from 'mobx-state-tree'

export default function BaseSession(pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      name: types.identifier,
      /**
       * #property
       */
      margin: 0,

      /**
       * #property
       */
      views: types.array(pluginManager.pluggableMstType('view', 'stateModel')),
    })
    .views(self => ({
      /**
       * #getter
       */
      get jbrowse() {
        return getParent<any>(self).jbrowse
      },
      /**
       * #getter
       */
      get adminMode() {
        return true
      },
    }))
    .volatile((/* self */) => ({
      /**
       * this is the globally "selected" object. can be anything.
       * code that wants to deal with this should examine it to see what
       * kind of thing it is.
       */
      selection: undefined as unknown,
      /**
       * this is the current "task" that is being performed in the UI.
       * this is usually an object of the form
       * `{ taskName: "configure", target: thing_being_configured }`
       */
      task: undefined,
    }))
    .actions(self => ({
      /**
       * #action
       * set the global selection, i.e. the globally-selected object.
       * can be a feature, a view, just about anything
       * @param thing -
       */
      setSelection(thing: unknown) {
        self.selection = thing
      },

      /**
       * #action
       * clears the global selection
       */
      clearSelection() {
        self.selection = undefined
      },
    }))
}

export type BaseSessionModel = Instance<ReturnType<typeof BaseSession>>
