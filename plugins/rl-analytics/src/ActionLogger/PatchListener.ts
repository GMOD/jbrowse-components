import { onAction, onPatch } from '@jbrowse/mobx-state-tree'

import ActionBuffer from './ActionBuffer.ts'
import ActionClassifier from './ActionClassifier.ts'
import { ActionType, type ClassifiedAction } from './ActionTypes.ts'

import type { IAnyStateTreeNode, ISerializedActionCall } from '@jbrowse/mobx-state-tree'

export type ActionCallback = (action: ClassifiedAction) => void

/**
 * Listens to MST patches on a session and classifies them into semantic actions.
 *
 * Also uses MST onAction to detect compound actions (e.g., zoomTo internally
 * calls scrollTo — the patches look like ZOOM + PAN, but the action is just
 * "zoomTo"). When a compound action is in progress, subordinate patches are
 * suppressed.
 */
export default class PatchListener {
  private classifier = new ActionClassifier()
  buffer: ActionBuffer
  private patchDisposer: (() => void) | null = null
  private actionDisposer: (() => void) | null = null
  private callbacks: ActionCallback[] = []
  private logUnknown: boolean
  private activeAction: string | null = null

  constructor(
    bufferSize = 10000,
    debounceMs = 100,
    logUnknown = false,
  ) {
    this.buffer = new ActionBuffer(bufferSize, debounceMs)
    this.logUnknown = logUnknown
  }

  attach(rootModel: IAnyStateTreeNode) {
    // Track top-level MST actions to detect compound operations
    this.actionDisposer = onAction(rootModel, (call: ISerializedActionCall) => {
      this.activeAction = call.name
    })

    this.patchDisposer = onPatch(rootModel, (patch, reversePatch) => {
      const action = this.classifier.classify(patch, reversePatch)
      if (action.type === ActionType.UNKNOWN && !this.logUnknown) {
        return
      }

      // Annotate with the MST action name that caused this patch
      if (this.activeAction) {
        action.metadata = {
          ...action.metadata,
          sourceAction: this.activeAction,
        }
      }

      this.buffer.push(action)
      for (const cb of this.callbacks) {
        try {
          cb(action)
        } catch {
          // Callback errors should not break the patch listener
        }
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
    this.patchDisposer?.()
    this.actionDisposer?.()
    this.patchDisposer = null
    this.actionDisposer = null
    this.buffer.dispose()
    this.callbacks = []
  }
}
