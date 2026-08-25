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

const getServerSnapshot = () => undefined

/**
 * Drop the tracked pointer, published by whoever bound the handlers.
 *
 * `mouseleave` reports the pointer leaving an element, and the browser decides
 * that by comparing the hover chain before a move to the chain after it. A menu
 * portalled to the body opens under the cursor with no move at all, and closing
 * it detaches the chain's nodes — so hover restarts at `body` and the display
 * the menu covered is never told anything again. Its overlays then keep drawing
 * at the coordinate the pointer had when the menu opened, wherever the pointer
 * has since gone.
 *
 * `ContextMenu` calls this on close, which is why the default is a no-op: a menu
 * raised outside a display's chrome has no tracked pointer to drop.
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
 * The position is measured against the box of whatever element the handlers are
 * bound to, which is what the overlays are positioned in — off `currentTarget`,
 * so there is no ref to pass and no way to bind the two to different elements.
 * A display that also hit-tests takes `onMove`, so its hit and its guides come
 * off one measurement in one frame instead of two pointer paths that have to
 * agree.
 *
 * **It returns a `mouseTracker` rather than the position, and that is the
 * load-bearing part.** Its one caller is `DisplayChromeBase`, which owns the
 * container the handlers bind to — so if the position were state here, every
 * mouse move would re-render the chrome itself (re-running
 * `useRenderingBackend`), the status container with a fresh inline `style`
 * object, all three overlays, and only then the body that actually wanted the
 * coordinate. That is a whole display's chrome repainting because the cursor
 * moved a pixel over it; it cost a full document `Layout` plus three `Paint`s
 * per mousemove on the wiggle displays, back when each display called this hook
 * itself and every one of them had it.
 *
 * So the position is published instead, and whoever wants it calls
 * `useMouseState(mouseTracker)` — from inside the chrome's body, where the
 * overlays live. Re-rendering then starts at the component that reads it.
 * Passing the tracker down a prop is free; passing `mouseState` down is the bug.
 */
export function useMouseTracking(onMove?: (state?: MouseState) => void) {
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(
    undefined,
  )
  const storeRef = useRef<MouseStore | undefined>(undefined)
  storeRef.current ??= createMouseStore()
  const store = storeRef.current
  // Reached through a ref rather than captured, so `handleMouseLeave` below can
  // be identity-stable — one of its callers is an effect, and a handler that
  // changed identity every render would make that effect re-run every render.
  // Reading the latest is also the better answer for the frame callback, which
  // runs after the render whose closure scheduled it.
  //
  // Written in an effect rather than during render: a render React discards must
  // not leave this pointing at a callback from it. Nothing can read it before
  // the first commit — both users are event/effect callbacks — and `useRef`'s
  // initial value covers the first commit itself.
  const onMoveRef = useRef(onMove)
  useEffect(() => {
    onMoveRef.current = onMove
  })

  /**
   * Drop the published position and tell `onMove` the pointer is gone.
   *
   * Bound as the container's `onMouseLeave` — and called directly for the two
   * cases `mouseleave` cannot report: the container being *removed* rather than
   * left, and a portalled menu closing over it. `DisplayChromeBase` makes both
   * calls, the second by publishing this on `ClearTrackedPointerProvider`.
   * Identity-stable for both.
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
    // An overlay portaled out of the container still *bubbles* its React events
    // here, even though its DOM node is not a descendant — so the coordinate
    // would be measured against a box the pointer isn't in. HiC guarded this by
    // hand (its resolution dropdown and legend portal); it is a hazard for any
    // display with a portaled overlay, and several have one, so the guard lives
    // here and applies to all of them. Treated as a leave: the pointer is over
    // something else, and the guides should drop rather than freeze.
    const { target } = event
    if (target instanceof Node && !event.currentTarget.contains(target)) {
      handleMouseLeave()
      return
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    const clientX = event.clientX
    const clientY = event.clientY
    // Captured here rather than read in the frame: React clears `currentTarget`
    // once the handler returns. `isConnected` then stands in for the ref check
    // this used to do — a display unmounted between the move and the frame
    // measures as a zero rect, and would publish the client point as if the
    // pointer were at the origin of a box that is gone.
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

/**
 * Read the tracked pointer position. Call this in the component that draws the
 * cursor-following thing, not in the one that bound the handlers — see
 * `useMouseTracking`.
 */
export function useMouseState(tracker: MouseTracker) {
  return useSyncExternalStore(
    tracker.subscribe,
    tracker.getSnapshot,
    getServerSnapshot,
  )
}
