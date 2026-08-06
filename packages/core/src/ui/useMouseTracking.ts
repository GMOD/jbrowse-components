import { useRef, useSyncExternalStore } from 'react'

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
 * Container-relative mouse position for the overlays that follow the pointer
 * (`Crosshairs`, tooltips), coalesced to one update per frame.
 *
 * Bind the handlers and the ref to the same element — the position is measured
 * against that element's box, which is what the overlays are positioned in. A
 * display that also hit-tests takes `onMove`, so its hit and its guides come off
 * one measurement in one frame instead of two pointer paths that have to agree.
 *
 * **It returns a `mouseTracker` rather than the position, and that is the
 * load-bearing part.** The handlers get bound to the chrome container, so the
 * component that calls this hook is the one *above* `DisplayChrome` — and if the
 * position were state here, every mouse move would re-render `DisplayChrome`,
 * `DisplayChromeBase` (which re-runs `useRenderingBackend`), the status
 * container with a fresh inline `style` object, all three overlays, and only
 * then the body that actually wanted the coordinate. That is a whole display's
 * chrome repainting because the cursor moved a pixel over it; it cost a full
 * document `Layout` plus three `Paint`s per mousemove on the wiggle displays,
 * and every consumer of this hook had it.
 *
 * So the position is published instead, and whoever wants it calls
 * `useMouseState(mouseTracker)` — from inside the chrome's body, where the
 * overlays live. Re-rendering then starts at the component that reads it.
 * Passing the tracker down a prop is free; passing `mouseState` down is the bug.
 */
export function useMouseTracking(
  ref: React.RefObject<HTMLDivElement | null>,
  onMove?: (state?: MouseState) => void,
) {
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | undefined>(
    undefined,
  )
  const storeRef = useRef<MouseStore | undefined>(undefined)
  storeRef.current ??= createMouseStore()
  const store = storeRef.current

  const handleMouseLeave = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    store.set(undefined)
    onMove?.(undefined)
  }

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
    rafRef.current = requestAnimationFrame(() => {
      const rect = ref.current?.getBoundingClientRect()
      if (rect) {
        const state = {
          x: clientX - rect.left,
          y: clientY - rect.top,
          clientX,
          clientY,
        }
        store.set(state)
        onMove?.(state)
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
