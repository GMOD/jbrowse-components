import { compilePredicates } from '@jbrowse/core/util/fieldPredicate'
import {
  attributeOf,
  parseAttributeValue,
  readChannelValue,
} from '@jbrowse/synteny-core'

import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

/** What a ribbon's filter reads: the record it draws and the pair's strand. */
export interface RibbonDatum {
  record: Feature
  strand: number
}

function ribbonField({ record, strand }: RibbonDatum, field: string): unknown {
  switch (field) {
    case 'strand':
      return strand
    case 'length':
      return record.get('end') - record.get('start')
  }
  const attribute = attributeOf(field)
  if (attribute === 'dnds') {
    const value = readChannelValue(record, attribute)
    return Number.isNaN(value) ? undefined : value
  }
  return parseAttributeValue(record.get(attribute))
}

/**
 * `ribbons.filter` as a test on each ribbon, the synteny views' predicate
 * list over the fields `color` takes and `length`, the record's bp; undefined
 * when the list tests nothing
 */
export function ribbonFilterOf(filter: readonly FieldPredicate[]) {
  return compilePredicates<RibbonDatum>(filter, field => ({
    kind: 'get',
    get: datum => ribbonField(datum, field),
  }))
}
