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
      queueOfDialogs: observable.array(
        [] as [DialogComponentType, Record<string, unknown>][],
      ),
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
      queueDialog(
        callback: (doneCallback: () => void) => [DialogComponentType, any],
      ): void {
        // NOTE: this base implementation doesn't include the changes from #2469,
        // hoping it's not needed anymore
        const [component, props] = callback(() => {
          self.queueOfDialogs.shift()
        })
        self.queueOfDialogs.push([component, props])
      },
    }))
}

export type DialogQueueManager = Instance<ReturnType<typeof DialogQueue>>
