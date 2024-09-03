import PluginManager from '@jbrowse/core/PluginManager'
import { Instance } from 'mobx-state-tree'
import { BaseSessionModel } from '@jbrowse/product-core'

/**
 * #stateModel DesktopSessionModel
 * #category session
 * extends [BaseSessionModel](../basesessionmodel)
 */
export function DesktopSessionFactory(pluginManager: PluginManager) {
  return BaseSessionModel(pluginManager)
    .props({
      /**
       * #property
       */
      margin: 0,
    })
    .views(() => ({
      /**
       * #getter
       */
      get adminMode() {
        return true
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
