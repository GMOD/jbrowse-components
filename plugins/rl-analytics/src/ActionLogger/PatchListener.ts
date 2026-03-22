import { onPatch } from '@jbrowse/mobx-state-tree'

import ActionBuffer from './ActionBuffer.ts'
import ActionClassifier from './ActionClassifier.ts'
import { ActionType, type ClassifiedAction } from './ActionTypes.ts'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export type ActionCallback = (action: ClassifiedAction) => void

export default class PatchListener {
  private classifier = new ActionClassifier()
  buffer: ActionBuffer
  private disposer: (() => void) | null = null
  private callbacks: ActionCallback[] = []
  private logUnknown: boolean

  constructor(
    bufferSize = 10000,
    debounceMs = 100,
    logUnknown = false,
  ) {
    this.buffer = new ActionBuffer(bufferSize, debounceMs)
    this.logUnknown = logUnknown
  }

  attach(rootModel: IAnyStateTreeNode) {
    this.disposer = onPatch(rootModel, (patch, reversePatch) => {
      const action = this.classifier.classify(patch, reversePatch)
      if (action.type === ActionType.UNKNOWN && !this.logUnknown) {
        return
      }
      this.buffer.push(action)
      for (const cb of this.callbacks) {
        cb(action)
      }
    })
  }

  onAction(callback: ActionCallback) {
    this.callbacks.push(callback)
    return () => {
      const idx = this.callbacks.indexOf(callback)
      if (idx >= 0) {
        this.callbacks.splice(idx, 1)
      }
    }
  }

  dispose() {
    this.disposer?.()
    this.disposer = null
    this.buffer.dispose()
    this.callbacks = []
  }
}
