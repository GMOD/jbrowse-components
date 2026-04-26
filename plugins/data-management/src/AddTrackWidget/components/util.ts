import type { AdapterType } from '@jbrowse/core/pluggableElementTypes'

// collate adapters into a map with
// - key: category
// - value: array of adapters with that category
export function categorizeAdapters(adaptersList: AdapterType[]) {
  const map = {} as Record<string, AdapterType[]>
  for (const adapter of adaptersList) {
    const key = adapter.adapterMetadata?.category || 'Default'
    map[key] ??= []
    map[key].push(adapter)
  }
  return map
}
