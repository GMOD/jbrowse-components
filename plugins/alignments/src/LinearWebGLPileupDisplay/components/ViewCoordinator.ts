/**
 * ViewCoordinator - Instant sync of view position across WebGL canvases
 *
 * Bypasses mobx for rendering to achieve smooth pan/zoom across multiple canvases.
 * Each canvas maintains local refs (offsetPx, bpPerPx) and broadcasts changes
 * instantly to other canvases in the same view.
 */

export interface ViewPosition {
  offsetPx: number
  bpPerPx: number
  domain: [number, number] | null
  sourceId: string
}

type PositionListener = (position: ViewPosition) => void

class ViewCoordinator {
  private listeners = new Map<string, PositionListener>()
  offsetPx = 0
  bpPerPx = 1

  get listenerCount(): number {
    return this.listeners.size
  }

  subscribe(canvasId: string, listener: PositionListener): () => void {
    this.listeners.set(canvasId, listener)
    return () => {
      this.listeners.delete(canvasId)
    }
  }

  broadcast(position: ViewPosition) {
    this.offsetPx = position.offsetPx
    this.bpPerPx = position.bpPerPx

    // Notify all listeners except the source - synchronously in same event loop
    for (const [canvasId, listener] of this.listeners) {
      if (canvasId !== position.sourceId) {
        listener(position)
      }
    }
  }
}

// Global registry keyed by view ID
const coordinators = new Map<string, ViewCoordinator>()

export function getCoordinator(viewId: string): ViewCoordinator {
  let coordinator = coordinators.get(viewId)
  if (!coordinator) {
    coordinator = new ViewCoordinator()
    coordinators.set(viewId, coordinator)
  }
  return coordinator
}

export function removeCoordinator(viewId: string) {
  coordinators.delete(viewId)
}
