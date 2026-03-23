import type { ClassifiedAction } from './ActionTypes.ts'

export type DebouncedActionCallback = (action: ClassifiedAction) => void

export default class ActionBuffer {
  private buffer: ClassifiedAction[] = []
  private maxSize: number
  private debounceMs: number
  private pendingAction: ClassifiedAction | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private debouncedCallbacks: DebouncedActionCallback[] = []

  constructor(maxSize = 10000, debounceMs = 100) {
    this.maxSize = maxSize
    this.debounceMs = debounceMs
  }

  /** Register a callback that fires only for debounced (merged) actions */
  onDebouncedAction(cb: DebouncedActionCallback) {
    this.debouncedCallbacks.push(cb)
  }

  push(action: ClassifiedAction) {
    if (
      this.pendingAction &&
      action.type === this.pendingAction.type &&
      action.timestamp - this.pendingAction.timestamp < this.debounceMs
    ) {
      // Merge into pending action — keep latest metadata and timestamp
      this.pendingAction = {
        ...this.pendingAction,
        timestamp: action.timestamp,
        patch: action.patch,
        reversePatch: this.pendingAction.reversePatch,
        metadata: this.mergeMetadata(this.pendingAction.metadata, action.metadata),
      }
      this.resetDebounceTimer()
      return
    }

    // Flush any pending action
    this.flushPending()

    // Start new debounce window
    this.pendingAction = action
    this.resetDebounceTimer()
  }

  private mergeMetadata(
    prev: Record<string, unknown>,
    next: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...next }
    // Accumulate delta for pan actions
    if (typeof prev.deltaPixels === 'number' && typeof next.deltaPixels === 'number') {
      merged.deltaPixels = (prev.deltaPixels as number) + (next.deltaPixels as number)
    }
    // Keep original values for zoom
    if (prev.oldBpPerPx !== undefined) {
      merged.oldBpPerPx = prev.oldBpPerPx
    }
    return merged
  }

  private resetDebounceTimer() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.flushPending()
    }, this.debounceMs)
  }

  private flushPending() {
    if (this.pendingAction) {
      this.addToBuffer(this.pendingAction)
      this.pendingAction = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  private addToBuffer(action: ClassifiedAction) {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift()
    }
    this.buffer.push(action)
    for (const cb of this.debouncedCallbacks) {
      try {
        cb(action)
      } catch {
        // don't break the buffer
      }
    }
  }

  /** Flush pending and return + clear all buffered actions */
  drain(): ClassifiedAction[] {
    this.flushPending()
    const actions = [...this.buffer]
    this.buffer = []
    return actions
  }

  /** Flush pending and return last N actions without clearing */
  getRecent(n: number): ClassifiedAction[] {
    this.flushPending()
    return this.buffer.slice(-n)
  }

  get length(): number {
    return this.buffer.length + (this.pendingAction ? 1 : 0)
  }

  dispose() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
  }
}
