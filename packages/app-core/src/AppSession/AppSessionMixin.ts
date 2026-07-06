import { getParent, types } from '@jbrowse/mobx-state-tree'

import type { AppRootModel } from './AppRootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseSession } from '@jbrowse/product-core'

/**
 * #stateModel AppSessionMixin
 *
 * Session getters shared by the "app" products (desktop + web) that simply
 * delegate to the root model — `version`, `history`, `menus`,
 * `assemblyManager` — plus `renameCurrentSession`. Centralized here so the
 * products compose one mixin instead of re-declaring (and diverging on) the
 * same root delegations. The root must satisfy {@link AppRootModel}.
 */
export function AppSessionMixin(_pluginManager: PluginManager) {
  return types
    .model({})
    .views(s => {
      const self = s as typeof s & BaseSession
      return {
        /**
         * #getter
         */
        get root(): AppRootModel {
          return getParent<AppRootModel>(self)
        },
      }
    })
    .views(self => ({
      /**
       * #getter
       */
      get version() {
        return self.root.version
      },
      /**
       * #getter
       */
      get gitCommit() {
        return self.root.gitCommit
      },
      /**
       * #getter
       */
      get history() {
        return self.root.history
      },
      /**
       * #getter
       */
      get assemblyManager() {
        return self.root.assemblyManager
      },
      /**
       * #method
       */
      menus() {
        return self.root.menus()
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        self.root.renameCurrentSession(sessionName)
      },
    }))
}
