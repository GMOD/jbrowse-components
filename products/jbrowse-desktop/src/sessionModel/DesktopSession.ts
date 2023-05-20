import PluginManager from '@jbrowse/core/PluginManager'
import { Instance } from 'mobx-state-tree'
import { BaseSessionModel } from '@jbrowse/product-core'

/**
 * #stateModel DesktopSessionModel
 * #category session
 */
export function DesktopSessionFactory(pluginManager: PluginManager) {
  return BaseSessionModel(pluginManager)
    .props({
      /**
       * #property
       */
      margin: 0,
    })
    .views(self => ({
      /**
       * #getter
       */
      get adminMode() {
        return true
      },
      /**
       * #getter
       */
      get version() {
        return self.root.version
      },
    }))
    .volatile((/* self */) => ({
      /**
       * this is the current "task" that is being performed in the UI.
       * this is usually an object of the form
       * `{ taskName: "configure", target: thing_being_configured }`
       */
      task: undefined,
    }))
}

export type DesktopSessionModel = Instance<
  ReturnType<typeof DesktopSessionFactory>
>
