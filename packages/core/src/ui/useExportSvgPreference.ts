import { useLocalStorage } from '../util/hooks.ts'

export function useExportSvgPreference<T>(key: string, val: T) {
  return useLocalStorage(`svg-${key}`, val)
}
