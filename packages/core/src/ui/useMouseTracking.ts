import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react'

export interface MouseState {
  x: number
  y: number
  clientX: number
  clientY: number
}

/**
 * The pointer position, as something to read rather than something you hold.
 *
 * `useMouseTracking` hands this back instead of the position itself, and that
 * indirection is the entire point — see there.
 */
export interface MouseTracker {
  subscribe: (onStoreChange: () => void) => () => void
  getSnapshot: () => MouseState | undefined
}

interface MouseStore extends MouseTracker {
  set: (next: MouseState | undefined) => void
}

// A box rather than a bare `let`, because oxlint narrows a closure-assigned
// `let` to its initializer and then reads every use of it as always-undefined.
function createMouseStore(): MouseStore {
  const box: { state: MouseState | undefined } = { state: undefined }
  const subscribers = new Set<() => void>()
  return {
    subscribe(onStoreChange) {
      subscribers.add(onStoreChange)
      return () => {
        subscribers.delete(onStoreChange)
      }
    },
    // Stable identity while nothing moves, which useSyncExternalStore requires:
    // the state object is replaced only in `set`, never rebuilt per read.
    getSnapshot() {
      return box.state
    },
    set(next) {
      box.state = next
      for (const onStoreChange of subscribers) {
        onStoreChange()
      }
    },
  }
}

/**
 * Drop the tracked pointer, published by whoever bound the handlers.
 *
 * A menu portalled to the body opens under the cursor with no move, and
 * closing it detaches the hover chain, so the display it covered never gets a
 * `mouseleave` and its overlays keep drawing where the menu opened.
 * `ContextMenu` calls this on close; the default is a no-op for a menu raised
 * outside a display's chrome.
 */
const ClearTrackedPointerContext = createContext<() => void>(() => {})

export const ClearTrackedPointerProvider = ClearTrackedPointerContext.Provider

export function useClearTrackedPointer() {
  return use(ClearTrackedPointerContext)
}

/**
 * Container-relative mouse position for the overlays that follow the pointer
 * (`Crosshairs`, tooltips), coalesced to one update per frame.
 *
 * The position is measured against the box of the element the handlers are
 * bound to, off `currentTarget`, which is what the overlays are positioned in.
 * A display that also hit-tests takes `onMove`, so its hit and its guides come
 * off one measurement in one frame.
 *
 * It returns a `mouseTracker` and not the position: the caller is
 * `DisplayChromeBase`, and position held as state there would re-render the
 * whole chrome on every mouse move. Whoever draws at the cursor calls
 * `useMouseState(mouseTracker)`, so re-rendering starts at that component.
 * Pass the tracker down, never the position.
 */
export function useMouseTracking(onMove?: (state?: MouseState) => void) {
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(
    undefined,
  )
  const storeRef = useRef<MouseStore | undefined>(undefined)
  storeRef.current ??= createMouseStore()
  const store = storeRef.current
  // Reached through a ref so `handleMouseLeave` is identity-stable (an effect
  // depends on it), and written in an effect so a render React discards cannot
  // leave it pointing at that render's callback.
  const onMoveRef = useRef(onMove)
  useEffect(() => {
    onMoveRef.current = onMove
  })

  /**
   * Drop the published position and tell `onMove` the pointer is gone.
   *
   * Bound as the container's `onMouseLeave`, and called directly for the three
   * cases `mouseleave` cannot report: the container being removed, a portalled
   * menu closing over it, and the pointer moving onto a portalled overlay.
   * `DisplayChromeBase` makes all three calls. Identity-stable.
   */
  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = undefined
    }
    store.set(undefined)
    onMoveRef.current?.(undefined)
  }, [store])

  const handleMouseMove = (event: React.MouseEvent) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    const clientX = event.clientX
    const clientY = event.clientY
    // Captured here: React clears `currentTarget` once the handler returns. A
    // display unmounted before the frame measures as a zero rect, hence the
    // `isConnected` check.
    const container = event.currentTarget
    rafRef.current = requestAnimationFrame(() => {
      if (container.isConnected) {
        const rect = container.getBoundingClientRect()
        const state = {
          x: clientX - rect.left,
          y: clientY - rect.top,
          clientX,
          clientY,
        }
        store.set(state)
        onMoveRef.current?.(state)
      }
    })
  }

  return {
    mouseTracker: store as MouseTracker,
    handleMouseMove,
    handleMouseLeave,
  }
}

const identity = (state: MouseState | undefined) => state

const noopSubscribe = () => () => {}

/**
 * Read something derived from the tracked pointer, re-rendering only when the
 * derived value changes.
 *
 * `useMouseState` renders once per frame the pointer moves, which is what a
 * thing drawn *at* the cursor wants. A consumer that only asks a question of the
 * position — "is the pointer inside this band?" — renders once per answer
 * instead, because `useSyncExternalStore` compares snapshots and a boolean
 * compares equal to the last one.
 *
 * The tracker is optional so a component can sit outside whatever bound the
 * handlers (a highlight band rendered in a test, say) and read a pointer that is
 * simply never there.
 */
export function useMouseSelector<T>(
  tracker: MouseTracker | undefined,
  selector: (state: MouseState | undefined) => T,
) {
  return useSyncExternalStore(
    tracker?.subscribe ?? noopSubscribe,
    () => selector(tracker?.getSnapshot()),
    () => selector(undefined),
  )
}

/**
 * Read the tracked pointer position. Call this in the component that draws the
 * cursor-following thing, not in the one that bound the handlers — see
 * `useMouseTracking`.
 */
export function useMouseState(tracker: MouseTracker) {
  return useMouseSelector(tracker, identity)
}
