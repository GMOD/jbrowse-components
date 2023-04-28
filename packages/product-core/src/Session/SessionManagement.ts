import { SnapshotIn } from 'mobx-state-tree'

import PluginManager from '@jbrowse/core/PluginManager'
import { Base } from '@jbrowse/product-core/src/Session'

export default function SessionManagement(pluginManager: PluginManager) {
  return Base(pluginManager)
    .props({})
    .views(self => ({
      /**
       * #getter
       */
      get savedSessions() {
        return self.jbrowse.savedSessions
      },
      /**
       * #getter
       */
      get savedSessionNames() {
        return self.jbrowse.savedSessionNames
      },
      /**
       * #action
       */
      addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return self.root.addSavedSession(sessionSnapshot)
      },

      /**
       * #action
       */
      removeSavedSession(sessionSnapshot: any) {
        return self.root.removeSavedSession(sessionSnapshot)
      },

      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        return self.root.renameCurrentSession(sessionName)
      },

      /**
       * #action
       */
      duplicateCurrentSession() {
        return self.root.duplicateCurrentSession()
      },

      /**
       * #action
       */
      activateSession(sessionName: any) {
        return self.root.activateSession(sessionName)
      },

      /**
       * #action
       */
      setDefaultSession() {
        return self.root.setDefaultSession()
      },

      /**
       * #action
       */
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return self.root.setSession(sessionSnapshot)
      },
    }))
}
