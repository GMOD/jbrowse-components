import { useState } from 'react'

import {
  localStorageGetBoolean,
  localStorageGetItem,
  localStorageSetBoolean,
  localStorageSetItem,
} from '@jbrowse/core/util'

// localStorage-backed UI state for the sample grid. Values are validated on
// read and the setters write through, so a corrupt/missing entry falls back to
// the default instead of throwing.

export function usePersistedBoolean(key: string, defaultVal: boolean) {
  const [value, setValue] = useState(() =>
    localStorageGetBoolean(key, defaultVal),
  )
  return [
    value,
    (v: boolean) => {
      setValue(v)
      localStorageSetBoolean(key, v)
    },
  ] as const
}

export function usePersistedEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  defaultVal: T,
) {
  const [value, setValue] = useState<T>(
    () => allowed.find(a => a === localStorageGetItem(key)) ?? defaultVal,
  )
  return [
    value,
    (v: T) => {
      setValue(v)
      localStorageSetItem(key, v)
    },
  ] as const
}
