import type { ClassifiedAction } from './ActionTypes.ts'

export type DebouncedActionCallback = (action: ClassifiedAction) => void

/**
 * Debouncing buffer for classified actions.
 *
 * Merges rapid same-type actions (e.g., rapid PAN from trackpad momentum)
 * into single logical actions. Emits via onDebouncedAction callback after
 * the debounce window closes.
 *
 * With the onAction-based listener, compound actions (zoomTo → scrollTo)
 * are already handled at the source — only top-level actions arrive here.
 * So the buffer only needs to merge same-type rapid events.
 */
export default class ActionBuffer {
  private buffer: ClassifiedAction[] = []
  private maxSize: number
  private debounceMs: number
  private pendingAction: ClassifiedAction | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private debouncedCallbacks: DebouncedActionCallback[] = []

  constructor(maxSize = 10000, debounceMs = 500) {
    this.maxSize = maxSize
    this.debounceMs = debounceMs
  }

  onDebouncedAction(cb: DebouncedActionCallback) {
    this.debouncedCallbacks.push(cb)
  }

  push(action: ClassifiedAction) {
    if (
      this.pendingAction &&
      action.type === this.pendingAction.type &&
      action.timestamp - this.pendingAction.timestamp < this.debounceMs
    ) {
      // Merge: keep first action's metadata but update timestamp
      this.pendingAction = {
        ...this.pendingAction,
        timestamp: action.timestamp,
        metadata: this.mergeMetadata(
          this.pendingAction.metadata,
          action.metadata,
        ),
      }
      this.resetDebounceTimer()
      return
    }

    this.flushPending()
    this.pendingAction = action
    this.resetDebounceTimer()
  }

  private mergeMetadata(
    prev: Record<string, unknown>,
    next: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...next }
    // Accumulate distance for pan actions
    if (
      typeof prev.distance === 'number' &&
      typeof next.distance === 'number'
    ) {
      merged.distance =
        (prev.distance as number) + (next.distance as number)
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

  drain(): ClassifiedAction[] {
    this.flushPending()
    const actions = [...this.buffer]
    this.buffer = []
    return actions
  }

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
