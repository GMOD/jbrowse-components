import { types } from '@jbrowse/mobx-state-tree'

import { isBaseSession } from './BaseSession.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { DialogComponentType } from '@jbrowse/core/util'
import type { IAnyStateTreeNode, Instance } from '@jbrowse/mobx-state-tree'

type DoneCallback = (
  doneCallback: () => void,
) => [DialogComponentType, Record<string, unknown>]
/**
 * #stateModel DialogQueueSessionMixin
 */
export function DialogQueueSessionMixin(_pluginManager: PluginManager) {
  return types
    .model('DialogQueueSessionMixin', {})
    .volatile(() => ({
      queueOfDialogs: [] as [DialogComponentType, Record<string, unknown>][],
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
      queueDialog(doneCallback: DoneCallback) {
        const [component, props] = doneCallback(() => {
          this.removeActiveDialog()
        })
        self.queueOfDialogs = [...self.queueOfDialogs, [component, props]]
      },
    }))
}

export type SessionWithDialogsType = ReturnType<typeof DialogQueueSessionMixin>
export type SessionWithDialogs = Instance<SessionWithDialogsType>

export function isSessionWithDialogs(
  session: IAnyStateTreeNode,
): session is SessionWithDialogs {
  return isBaseSession(session) && 'queueOfDialogs' in session
}
