import { useEffect, useRef, useState } from 'react'

import { useEventCallback } from '@jbrowse/core/util/useEventCallback'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { isAlive } from '@jbrowse/mobx-state-tree'

// relative, not through the `util` barrel: that barrel re-exports this file
import {
  localStorageAvailable,
  localStorageGetJSON,
  localStorageRemoveItem,
  localStorageSetItem,
  notifyLocalStorageKey,
  subscribeToLocalStorageKey,
} from './localStorage.ts'

import type { RefObject } from 'react'

// Fires `onInteract` when a mousedown/keydown/focusin lands inside `ref`; used
// to set the focused view on click and on Tab. Listens at the document level
// rather than through React handlers so one listener covers the whole subtree,
// but bubble-phase: a child calling stopPropagation DOES suppress it, which is
// why `ResizeHandle` claims its press with a `data-gesture-owner` marker instead
// of stopping the mousedown. Registering with `{ capture: true }` would make
// focus survive those, at the cost of focusing the view for menus and error bars
// that currently do not — a behavior change, not a bug fix.
//
// **`focusin` is the one that makes keyboard entry work**, and it is not
// redundant with `keydown`. A Tab that moves focus INTO the container fires its
// keydown on the element being left, which is outside `ref` — so with keydown
// alone the assignment lagged a keystroke, and the first shortcut a keyboard
// user pressed after arriving went to whichever view they came from.
// `focusin` (unlike `focus`) bubbles, so one document listener sees it, and its
// target is the element that just RECEIVED focus. A mouse press on a focusable
// node fires both; `onInteract` is idempotent for every caller (it assigns an
// id), so the double call costs nothing.
//
// `onInteract` is wrapped in a stable callback so callers can pass an inline
// closure without re-subscribing the listeners every render (we don't rely on
// the React Compiler memoizing it, since library consumers may not run it).
export function useFocusOnInteraction(
  ref: RefObject<HTMLElement | null>,
  onInteract: () => void,
) {
  const stableOnInteract = useEventCallback(onInteract)
  useEffect(() => {
    function handleSelectView(e: Event) {
      if (e.target instanceof Element && ref.current?.contains(e.target)) {
        stableOnInteract()
      }
    }
    document.addEventListener('mousedown', handleSelectView)
    document.addEventListener('keydown', handleSelectView)
    document.addEventListener('focusin', handleSelectView)
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
      document.removeEventListener('focusin', handleSelectView)
    }
  }, [ref, stableOnInteract])
}

export function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => {
      clearTimeout(handle)
    }
  }, [value, delay])

  return debouncedValue
}

// used in ViewContainer files to get the width. useMeasure reports the content
// box, so padding is already excluded from the measured width.
//
// Width-only on purpose: the observed element is the whole view container, so
// its height moves whenever a track is added, resized or grows with its data.
// Measuring both axes turned every one of those into a re-render of the view
// chrome (two MUI Papers, the header and its buttons) for a number this hook
// never reads.
export function useWidthSetter(view: {
  setWidth: (arg: number) => void
  id?: string
}) {
  const [ref, { width }] = useMeasure('width')
  useEffect(() => {
    let token: ReturnType<typeof requestAnimationFrame>
    if (width && isAlive(view)) {
      // sets after a requestAnimationFrame
      // https://stackoverflow.com/a/58701523/2129219
      // avoids ResizeObserver loop error being shown during development
      token = requestAnimationFrame(() => {
        view.setWidth(width)
      })
    }

    return () => {
      if (token) {
        cancelAnimationFrame(token)
      }
    }
  }, [view, width])
  return ref
}

/**
 * Build a value exactly once per mount — including under React StrictMode,
 * which `useState(() => build())` does not.
 *
 * StrictMode double-invokes a state initializer in development and throws the
 * SECOND result away. For an ordinary value that is the intended lint: it
 * surfaces impure initializers and costs nothing. For anything that owns
 * something — an MST tree, a worker pool, a subscription — it stands up a second
 * one and then drops the only reference to it, so nothing can ever tear it down,
 * and it is invisible because the one React kept behaves perfectly.
 *
 * A ref is written once and survives the double render; this is React's own
 * "avoiding recreating the ref contents" pattern.
 */
export function useCreateOnce<T>(create: () => T): T {
  // boxed, so a `create` that legitimately returns undefined isn't re-run every
  // render by the nullish assignment
  const ref = useRef<{ value: T } | undefined>(undefined)
  ref.current ??= { value: create() }
  return ref.current.value
}

/**
 * Run `cleanup` when the component *really* unmounts.
 *
 * "Really" is the whole difficulty, because React does not distinguish a final
 * unmount from a simulated one. The obvious spelling —
 * `useEffect(() => () => cleanup(), [])` — is wrong in exactly the environment
 * most hosts develop in, jbrowse-web included: StrictMode runs
 * setup → cleanup → setup on a live component, so a cleanup that destroys
 * something leaves the component holding the destroyed thing for the rest of its
 * life, with the second setup having nothing to rebuild from. For an MST tree
 * that is not a quiet degradation — the next read throws `[mobx-state-tree] …
 * [dead]`.
 *
 * So the teardown is deferred by a microtask and cancelled if setup runs again.
 * StrictMode's cleanup and re-setup are one synchronous block, so the cancel
 * always wins there; a real unmount never runs setup again, so the microtask
 * fires.
 *
 * This owns a *component's* teardown, not a per-value one: `cleanup` always sees
 * the latest render's closure, and swapping the thing being torn down mid-life
 * is not supported. Pair it with {@link useCreateOnce}, which is the shape that
 * makes that true.
 *
 * Deliberately not covered: a subtree hidden with `<Activity>`, which destroys
 * effects and re-creates them a TASK later rather than synchronously, so the
 * cancel below cannot reach it. Measured, not assumed — `useFinalUnmount.test.tsx`
 * pins that hiding tears the value down and showing does not rebuild it, since
 * `useCreateOnce`'s ref survives the hide. A host that needs a view to survive
 * being hidden owns the engine itself and keeps it outside the hidden tree.
 */
export function useFinalUnmount(cleanup: () => void) {
  const stableCleanup = useEventCallback(cleanup)
  const teardownPending = useRef(false)
  useEffect(() => {
    // this setup owns the value: cancel a teardown a preceding cleanup queued
    teardownPending.current = false
    return () => {
      teardownPending.current = true
      queueMicrotask(() => {
        if (teardownPending.current) {
          // cleared BEFORE running, so the teardown happens once however many
          // microtasks are in flight. A StrictMode mount queues one that its
          // own re-setup cancels — but only if that microtask has drained
          // before the next cleanup. Unmount inside the same synchronous block
          // as the mount (a test, a route that redirects on its first effect)
          // and it has not: the stale microtask finds the flag set again by the
          // real cleanup and fires, then the real one fires too. Idempotent
          // teardowns hid it, which is every caller in the tree today.
          teardownPending.current = false
          stableCleanup()
        }
      })
    }
  }, [stableCleanup])
}

function resolveUpdate<T>(value: T | ((val: T) => T), prev: T) {
  return typeof value === 'function' ? (value as (val: T) => T)(prev) : value
}

/**
 * `useState` backed by a localStorage key.
 *
 * Originally https://usehooks.com/useLocalStorage/, which is per-instance: two
 * components on the same key each kept their own copy of it, so toggling a
 * setting in one BreakpointSplitView header left a second one open beside it
 * showing the old value until it remounted. Instances on a key now subscribe to
 * each other's writes, and to other tabs' — `subscribeToLocalStorageKey`, which
 * the grid-bookmark widget shares from its state model.
 *
 * The store is read on every notify rather than cached, so nothing here can go
 * stale against a `localStorage.clear()`. Which also means a functional update
 * resolves against what is actually stored: two `setValue(v => …)` calls in one
 * handler used to keep only the second, because both resolved against the value
 * captured by the render that produced the setter.
 *
 * `enabled: false` keeps the value in component state only: nothing is read,
 * written or shared. Callers use it for a key that isn't meaningful yet (no
 * assembly chosen, so nothing to scope the key to). A page with no usable store
 * at all — an RPC worker, SSR, a cross-origin iframe with third-party storage
 * blocked, which is the embedded products on someone else's page — runs in that
 * same mode, because reading a key back through a store that dropped the write
 * answers the default and would report it as the stored value: the control
 * would revert the instant the user moved it.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  enabled = true,
) {
  // one concept, not two: `persists` is "this key is really backed by the
  // store", and everything below branches on it rather than on `enabled`
  const persists = enabled && localStorageAvailable()
  const [storedValue, setStoredValue] = useState<T>(() =>
    persists ? localStorageGetJSON(key, initialValue) : initialValue,
  )
  // re-read when the key or `persists` changes at runtime (the useState
  // initializer only runs once); render-phase reset rather than an effect
  const [prev, setPrev] = useState({ key, persists })
  // Latched when the store refuses a write. Until then the store is the base
  // every update resolves against, which is what makes two `setValue(v => …)`
  // calls in one handler both land. Afterwards it cannot be: the store still
  // holds the value the user changed away from, so every later update would
  // recompute the same `next` from it and the control would move once and then
  // stick. Reset with the key, since the refusal was about this one.
  const storeRefusedRef = useRef(false)
  if (key !== prev.key || persists !== prev.persists) {
    setPrev({ key, persists })
    storeRefusedRef.current = false
    setStoredValue(
      persists ? localStorageGetJSON(key, initialValue) : initialValue,
    )
  }

  // initialValue is deliberately not a dependency: callers pass inline literals
  // (`[]`, `{}`), and it only ever decides what an absent key reads as
  const initialRef = useRef(initialValue)
  initialRef.current = initialValue
  useEffect(() => {
    if (!persists) {
      return
    }
    return subscribeToLocalStorageKey(key, () => {
      setStoredValue(localStorageGetJSON(key, initialRef.current))
    })
  }, [key, persists])

  const setValue = useEventCallback((value: T | ((val: T) => T)) => {
    if (!persists || storeRefusedRef.current) {
      setStoredValue(prevValue => resolveUpdate(value, prevValue))
      return
    }
    const next = resolveUpdate(
      value,
      localStorageGetJSON(key, initialRef.current),
    )
    const wrote =
      next === undefined
        ? // clearing the key, not storing the string "undefined" — which is what
          // `setItem(key, JSON.stringify(undefined))` writes, and which then
          // throws on the way back in. `useAssemblySelection` holds a
          // `string | undefined`
          localStorageRemoveItem(key)
        : localStorageSetItem(key, JSON.stringify(next))
    if (wrote) {
      notifyLocalStorageKey(key)
    } else {
      // The store read fine and then refused the write: quota exhausted, or
      // Safari private browsing. Notifying would hand every instance what the
      // store still holds — the value the user just changed away from — so the
      // control would snap back. Fall to the same component-local mode
      // `enabled: false` runs in.
      storeRefusedRef.current = true
      setStoredValue(next)
    }
  })

  return [storedValue, setValue] as const
}

/**
 * The CSS custom property a scroll port publishes its own visible height as, for
 * descendants that have to size against the surface they actually scroll in.
 *
 * `100vh` is the wrong answer for all three of JBrowse's scroll ports and looks
 * right in the one place it is least wrong: the classic view stack sits under a
 * 48px AppBar (measured 852 against a 900px window), a workspace panel is an
 * arbitrary dockview cell, and a bounded embedded view is whatever box the host
 * gave it. A sticky element's offsets are relative to its scroll port, so a
 * `max-height` that bounds one has to be too.
 */
export const SCROLL_PORT_HEIGHT_VAR = '--jbrowse-scrollport-height'

/**
 * Publishes {@link SCROLL_PORT_HEIGHT_VAR} on the element the returned ref is
 * attached to. Put it on the element that actually scrolls; the property
 * inherits, so anything inside can read it with a `100vh` fallback for hosts
 * that never mount one.
 *
 * Written straight to the node instead of through state on purpose. This sits on
 * a container wrapping every view, so a re-render per resize frame would
 * re-render all of them to produce a number only CSS reads.
 */
export function useScrollPortHeightVar() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !('ResizeObserver' in window)) {
      return
    }
    // clientHeight, not the border box: it is the visible content area net of a
    // horizontal scrollbar, which is the box a sticky child is bounded by
    const publish = () => {
      el.style.setProperty(SCROLL_PORT_HEIGHT_VAR, `${el.clientHeight}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])
  return ref
}

/**
 * Heights of the chrome boxes a sticky element below them has to clear. Each is
 * published from a measurement rather than assumed, because the constants they
 * default to are nominal: `VIEW_HEADER_HEIGHT` and the LGV header bar's height
 * were written into the CSS by the pin-elements work (#4237) so that the sticky
 * offsets summing them would be true, and a box pinned to a constant clips its
 * own content once the root font size grows — measured on the stock theme, the
 * view header overflows at a 18px root and the LGV controls row at 24px.
 *
 * So the CSS heights are minimums and these carry the truth. The fallbacks keep
 * the nominal answer for the frame before the first measurement, and for a host
 * that mounts no publisher.
 */
export const VIEW_HEADER_HEIGHT_VAR = '--jbrowse-view-header-height'
export const LGV_HEADER_HEIGHT_VAR = '--jbrowse-lgv-header-height'

/**
 * Publishes the measured height of `ref`'s element as `varName`, set on its
 * **parent**. The parent, not the element itself: what reads these is a sticky
 * sibling *below* the measured box, so publishing on the box would put the
 * property out of the reader's inheritance chain.
 *
 * Takes the ref rather than returning one — the boxes being measured are also
 * the ones a view scrolls into view or hangs a gesture on, so they tend to
 * already have one.
 *
 * Written straight to the node rather than through state, for the reason
 * {@link useScrollPortHeightVar} gives — and here with the extra one that a
 * header re-rendering on its own resize is a loop waiting for a rounding error.
 */
export function useChromeHeightVar(
  ref: React.RefObject<HTMLElement | null>,
  varName: string,
) {
  useEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent || !('ResizeObserver' in window)) {
      return
    }
    // the border box: this is a distance a sibling below has to clear, not a
    // content area
    const publish = () => {
      parent.style.setProperty(varName, `${el.offsetHeight}px`)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => {
      observer.disconnect()
      parent.style.removeProperty(varName)
    }
  }, [ref, varName])
}
