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
} from './localStorage.ts'

import type { RefObject } from 'react'

// Fires `onInteract` when a mousedown/keydown lands inside `ref`; used to set
// the focused view on click. Listens at the document level rather than through
// React handlers so one listener covers the whole subtree, but bubble-phase:
// a child calling stopPropagation DOES suppress it, which is why `ResizeHandle`
// claims its press with a `data-gesture-owner` marker instead of stopping the
// mousedown. Registering with `{ capture: true }` would make focus survive
// those, at the cost of focusing the view for menus and error bars that
// currently do not — a behavior change, not a bug fix.
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
    return () => {
      document.removeEventListener('mousedown', handleSelectView)
      document.removeEventListener('keydown', handleSelectView)
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

// The mounted hooks watching each key. Deliberately NOT a value cache beside
// it: localStorage is itself the shared value, and a second copy of it only
// creates a way for the two to disagree — a `localStorage.clear()` (a factory
// reset, a test's teardown) would leave every mounted hook showing what it had
// before, and the cache has no way to hear about it.
const listeners = new Map<string, Set<() => void>>()

function notify(key: string) {
  for (const fn of listeners.get(key) ?? []) {
    fn()
  }
}

// Installed once, on the first subscription rather than at module scope, so
// importing this file from a worker or a test never touches `window`.
let storageListenerInstalled = false

function installStorageListener() {
  if (storageListenerInstalled || typeof window === 'undefined') {
    return
  }
  storageListenerInstalled = true
  // Another tab wrote one of our keys. `key === null` is a clear(), which is
  // every key at once.
  window.addEventListener('storage', e => {
    if (e.storageArea !== window.localStorage) {
      return
    }
    if (e.key === null) {
      for (const k of [...listeners.keys()]) {
        notify(k)
      }
    } else if (listeners.has(e.key)) {
      notify(e.key)
    }
  })
}

function subscribe(key: string, fn: () => void) {
  installStorageListener()
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(fn)
  return () => {
    set.delete(fn)
    if (!set.size) {
      listeners.delete(key)
    }
  }
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
 * each other's writes, and to other tabs' — the thing the grid-bookmark widget
 * had to hand-roll a `storage` listener for.
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
    return subscribe(key, () => {
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
      notify(key)
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
