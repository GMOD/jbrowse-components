/** MST mixin for managing a queue of dialogs at the level of the session */

import PluginManager from '@jbrowse/core/PluginManager'
import { DialogComponentType } from '@jbrowse/core/util'
import { observable } from 'mobx'
import { IAnyStateTreeNode, Instance, types } from 'mobx-state-tree'

export interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

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

export type DialogQueueManagerType = ReturnType<typeof DialogQueue>
export type DialogQueueManager = Instance<DialogQueueManagerType>
