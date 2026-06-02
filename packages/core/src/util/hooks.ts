import { useEffect, useState } from 'react'

import useMeasure from '@jbrowse/core/util/useMeasure'
import { isAlive } from '@jbrowse/mobx-state-tree'

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

// used in ViewContainer files to get the width
export function useWidthSetter(
  view: { setWidth: (arg: number) => void },
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
