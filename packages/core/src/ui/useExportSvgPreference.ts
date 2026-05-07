import { useLocalStorage } from '../util/index.ts'

export function useExportSvgPreference<T>(key: string, val: T) {
  return useLocalStorage(`svg-${key}`, val)
}
