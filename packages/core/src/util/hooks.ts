import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

import { useEventCallback } from '@jbrowse/core/util/useEventCallback'
import useMeasure from '@jbrowse/core/util/useMeasure'
import { isAlive } from '@jbrowse/mobx-state-tree'

// Fires `onInteract` when a mousedown/keydown lands inside `ref`. Listens at the
// document level (not via React handlers) so it still fires when child drag
// handlers call stopPropagation; used to set the focused view on click.
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

// TEMP DEBUG: gated width-set instrumentation to profile dockview re-layout
// thrash (set window.__WIDTH_DEBUG__ = true). Remove after investigation.
function widthDebug(): { count: number } | undefined {
  const w = globalThis as typeof globalThis & {
    __WIDTH_DEBUG__?: boolean
    __widthSet__?: { count: number }
  }
  if (!w.__WIDTH_DEBUG__) {
    return undefined
  }
  w.__widthSet__ ??= { count: 0 }
  return w.__widthSet__
}

// used in ViewContainer files to get the width
export function useWidthSetter(
  view: { setWidth: (arg: number) => void; id?: string },
  padding: string,
) {
  const [ref, { width }] = useMeasure()
  useEffect(() => {
    let token: ReturnType<typeof requestAnimationFrame>
    if (width && isAlive(view)) {
      // sets after a requestAnimationFrame
      // https://stackoverflow.com/a/58701523/2129219
      // avoids ResizeObserver loop error being shown during development
      token = requestAnimationFrame(() => {
        const dbg = widthDebug()
        if (dbg) {
          dbg.count++
          console.log(
            `[WIDTHSET] view=${view.id ?? '?'} width=${width} total=${dbg.count} t=${Math.round(performance.now())}`,
          )
        }
        view.setWidth(width)
      })
    }

    return () => {
      if (token) {
        cancelAnimationFrame(token)
      }
    }
  }, [padding, view, width])
  return ref
}

// Hook from https://usehooks.com/useLocalStorage/
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  enabled = true,
) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined' || !enabled) {
      return initialValue
    }
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        typeof value === 'function'
          ? (value as (val: T) => T)(storedValue)
          : value
      setStoredValue(valueToStore)
      if (typeof window !== 'undefined' && enabled) {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(error)
    }
  }
  return [storedValue, setValue] as const
}
