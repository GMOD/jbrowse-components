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
  return +(localStorageGetItem(key) ?? defaultVal)
}

export function localStorageGetBoolean(key: string, defaultVal: boolean) {
  const item = localStorageGetItem(key)
  return item !== null && item !== undefined ? JSON.parse(item) : defaultVal
}

export function localStorageSetBoolean(key: string, value: boolean) {
  localStorageSetItem(key, JSON.stringify(value))
}
