import { getParent, types } from '@jbrowse/mobx-state-tree'

import type { AppSessionRoot } from './AppSessionRoot.ts'

/**
 * #stateModel AppSessionMixin
 *
 * Session getters shared by the "app" products (desktop + web) that simply
 * delegate to the root model — `version`, `history`, `menus`,
 * `assemblyManager` — plus `renameCurrentSession`. Centralized here so the
 * products compose one mixin instead of re-declaring (and diverging on) the
 * same root delegations. The root must satisfy {@link AppSessionRoot}.
 */
export function AppSessionMixin() {
  return types
    .model({})
    .views(self => ({
      /**
       * #getter
       */
      get root(): AppSessionRoot {
        return getParent<AppSessionRoot>(self)
      },
    }))
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
