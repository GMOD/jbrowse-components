import { fieldReader } from '@jbrowse/core/util/fieldReader'
import { valueText } from '@jbrowse/core/util/groupKeys'

import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/**
 * The record fields the records band reads that the cell payload does not
 * otherwise carry, each `''` where nothing is read: `tooltip`, a
 * `records.tooltip.field` other than its default, `facet`,
 * `records.facet.field`, and `labelName` and `labelDescription`, a
 * `records.labels` field other than its default. The worker reads them, since
 * only it holds the whole record.
 */
export interface RecordFieldReads {
  tooltip: string
  facet: string
  labelName: string
  labelDescription: string
}

export const NO_RECORD_FIELD_READS: RecordFieldReads = {
  tooltip: '',
  facet: '',
  labelName: '',
  labelDescription: '',
}

function textReader(field: string, jexl: JexlInstance) {
  const read = field === '' ? undefined : fieldReader(field, jexl)
  return (feature: Feature) => (read ? valueText(read(feature)) : '')
}

/** What the cell loop reads off each record for {@link RecordFieldReads}. */
export function recordFieldReaders(
  reads: RecordFieldReads,
  jexl: JexlInstance,
) {
  return {
    tooltip: textReader(reads.tooltip, jexl),
    groupKey: textReader(reads.facet, jexl),
    labelName: textReader(reads.labelName, jexl),
    labelDescription: textReader(reads.labelDescription, jexl),
  }
}

export type RecordFieldReaders = ReturnType<typeof recordFieldReaders>

export const NO_RECORD_FIELD_READERS: RecordFieldReaders = {
  tooltip: () => '',
  groupKey: () => '',
  labelName: () => '',
  labelDescription: () => '',
}
