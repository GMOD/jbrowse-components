export function localStorageGetItem(item: string) {
  return typeof localStorage !== 'undefined'
    ? localStorage.getItem(item)
    : undefined
}

export function localStorageSetItem(str: string, item: string) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(str, item)
  }
}

export function localStorageGetNumber(key: string, defaultVal: number) {
  const parsed = +(localStorageGetItem(key) ?? defaultVal)
  return Number.isNaN(parsed) ? defaultVal : parsed
}

export function localStorageGetJSON<T>(key: string, defaultVal: T): T {
  const stored = localStorageGetItem(key)
  if (stored) {
    try {
      return JSON.parse(stored) as T
    } catch (e) {
      console.warn(`Invalid localStorage value for ${key}:`, stored, e)
    }
  }
  return defaultVal
}

export function localStorageSetJSON(key: string, val: unknown) {
  if (val !== undefined && val !== null) {
    localStorageSetItem(key, JSON.stringify(val))
  }
}

export function localStorageGetBoolean(key: string, defaultVal: boolean) {
  return Boolean(localStorageGetJSON(key, defaultVal))
}

export function localStorageSetBoolean(key: string, value: boolean) {
  localStorageSetItem(key, JSON.stringify(value))
}

export function localStorageSetNumber(key: string, value: number) {
  localStorageSetItem(key, JSON.stringify(value))
}
