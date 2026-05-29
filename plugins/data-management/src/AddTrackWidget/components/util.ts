import { groupBy } from '@jbrowse/core/util'

import type { IndexingAttr } from '../model.ts'
import type { AdapterType } from '@jbrowse/core/pluggableElementTypes'

export const defaultIndexingConf: IndexingAttr = {
  attributes: ['Name', 'ID'],
  exclude: ['CDS', 'exon'],
}

export function categorizeAdapters(adaptersList: AdapterType[]) {
  return groupBy(
    adaptersList,
    adapter => adapter.adapterMetadata?.category ?? 'Default',
  )
}
