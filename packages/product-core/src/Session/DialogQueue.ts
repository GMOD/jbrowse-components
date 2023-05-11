/** MST mixin for managing a queue of dialogs at the level of the session */

import PluginManager from '@jbrowse/core/PluginManager'
import { DialogComponentType } from '@jbrowse/core/util'
import { IAnyStateTreeNode, Instance, types } from 'mobx-state-tree'
import { isBaseSession } from './Base'

export interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

/**
 * #stateModel DialogQueueSessionMixin
 */
export default function DialogQueue(pluginManager: PluginManager) {
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
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[0]
        }
        return undefined
      },
      /**
       * #getter
       */
      get DialogProps() {
        if (self.queueOfDialogs.length) {
          const firstInQueue = self.queueOfDialogs[0]
          return firstInQueue && firstInQueue[1]
        }
        return undefined
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
        callback: (doneCallback: () => void) => [DialogComponentType, unknown],
      ): void {
        const [component, props] = callback(() => {
          this.removeActiveDialog()
        })
        self.queueOfDialogs = [...self.queueOfDialogs, [component, props]]
      },
    }))
}

/** Session mixin MST type for a session that has `queueOfDialogs`, etc. */
export type SessionWithDialogsType = ReturnType<typeof DialogQueue>

/** Instance of a session that has dialogs */
export type SessionWithDialogs = Instance<SessionWithDialogsType>

/** Type guard for SessionWithDialogs */
export function isSessionWithDialogs(
  session: IAnyStateTreeNode,
): session is SessionWithDialogs {
  return isBaseSession(session) && 'queueOfDialogs' in session
}
