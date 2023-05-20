/** MST mixin for managing a queue of dialogs at the level of the session */

import PluginManager from '@jbrowse/core/PluginManager'
import { DialogComponentType } from '@jbrowse/core/util'
import { IAnyStateTreeNode, Instance, types } from 'mobx-state-tree'
import { isBaseSession } from './BaseSession'

/**
 * #stateModel DialogQueueSessionMixin
 */
export function DialogQueueSessionMixin(pluginManager: PluginManager) {
  return types
    .model('DialogQueueSessionMixin', {})
    .volatile(() => ({
      queueOfDialogs: [] as [DialogComponentType, unknown][],
    }))
    .views(self => ({
      /**
       * #getter
       */
      get DialogComponent() {
        return self.queueOfDialogs[0]?.[0]
      },
      /**
       * #getter
       */
      get DialogProps() {
        return self.queueOfDialogs[0]?.[1]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      removeActiveDialog() {
        self.queueOfDialogs = self.queueOfDialogs.slice(1)
      },
      /**
       * #action
       */
      queueDialog(
        cb: (doneCallback: () => void) => [DialogComponentType, unknown],
      ) {
        const [component, props] = cb(() => {
          this.removeActiveDialog()
        })
        self.queueOfDialogs = [...self.queueOfDialogs, [component, props]]
      },
    }))
}

/** Session mixin MST type for a session that has `queueOfDialogs`, etc. */
export type SessionWithDialogsType = ReturnType<typeof DialogQueueSessionMixin>

/** Instance of a session that has dialogs */
export type SessionWithDialogs = Instance<SessionWithDialogsType>

/** Type guard for SessionWithDialogs */
export function isSessionWithDialogs(
  session: IAnyStateTreeNode,
): session is SessionWithDialogs {
  return isBaseSession(session) && 'queueOfDialogs' in session
}
