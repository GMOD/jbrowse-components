/** MST mixin for managing a queue of dialogs at the level of the session */

import PluginManager from '@jbrowse/core/PluginManager'
import {
  DialogComponentType,
  TrackViewModel,
  getContainingView,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import {
  IAnyStateTreeNode,
  getMembers,
  getParent,
  getSnapshot,
  getType,
  isModelType,
  isReferenceType,
  types,
  walk,
} from 'mobx-state-tree'

import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

export interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

export default function DialogQueue(pluginManager: PluginManager) {
  return types
    .model('DialogQueueSessionMixin', {})
    .volatile(() => ({
      queueOfDialogs: [] as [DialogComponentType, any][],
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
        const [component, props] = callback(() => {
          self.queueOfDialogs.shift()
        })
        self.queueOfDialogs.push([component, props])
      },
    }))
}
