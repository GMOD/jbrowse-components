import { groupBy } from '@jbrowse/core/util'

import type { AdapterType } from '@jbrowse/core/pluggableElementTypes'

export function categorizeAdapters(adaptersList: AdapterType[]) {
  return groupBy(
    adaptersList,
    adapter => adapter.adapterMetadata?.category ?? 'Default',
  )
}
