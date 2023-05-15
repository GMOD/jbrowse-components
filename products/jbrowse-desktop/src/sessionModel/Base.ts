import PluginManager from '@jbrowse/core/PluginManager'
import { Instance } from 'mobx-state-tree'
import { Session as CoreSession } from '@jbrowse/product-core'

/**
 * #stateModel JBrowseDesktopSessionMixin
 * #category session
 */
export default function BaseSession(pluginManager: PluginManager) {
  return CoreSession.Base(pluginManager)
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

export type BaseSessionModel = Instance<ReturnType<typeof BaseSession>>
