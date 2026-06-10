import { getParent, types } from '@jbrowse/mobx-state-tree'

import type { AbstractWebSessionDbRootModel } from './WebRootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * #stateModel WebSessionManagementMixin
 *
 * Saved-session-database actions (favorites, recent sessions, activate/delete)
 * delegating to the root's {@link AbstractWebSessionDbRootModel}. Composed only
 * by the full-app jbrowse-web session; react-app omits it (its root has no
 * session database).
 */
export function WebSessionManagementMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .views(self => ({
      /**
       * #getter
       */
      get savedSessionMetadata() {
        return getParent<AbstractWebSessionDbRootModel>(self).savedSessionMetadata
      },
    }))
    .actions(self => {
      const root = () => getParent<AbstractWebSessionDbRootModel>(self)
      return {
        /**
         * #action
         */
        deleteSavedSession(id: string) {
          return root().deleteSavedSession(id)
        },
        /**
         * #action
         */
        setSavedSessionFavorite(id: string, favorite: boolean) {
          return root().setSavedSessionFavorite(id, favorite)
        },
        /**
         * #action
         */
        renameSavedSession(id: string, name: string) {
          return root().renameSavedSession(id, name)
        },
        /**
         * #action
         */
        activateSession(id: string) {
          return root().activateSession(id)
        },
      }
    })
}
