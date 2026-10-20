import { compilePredicates } from '@jbrowse/core/util/fieldPredicate'

import { attributeOf, isAttributeLabels } from './colorRamps.ts'

import type { ColorFunctionInputs } from './colorFunctions.ts'
import type {
  FieldPredicate,
  PredicateLane,
} from '@jbrowse/core/util/fieldPredicate'

/** What a comparative payload knows beyond its color inputs. */
export interface FilterExtras {
  // an alignment's length in bp on its own axis
  lengthOf?: (index: number) => number
  // the track every record of this payload came from
  trackId?: string
}

/**
 * Where each field of a comparative payload lives: `length` and `track` from
 * the extras, `strand` and the two sequence names from their lanes, and a
 * measurement or column from its attribute channel, dictionary-coded where
 * the column is text.
 */
export function comparativeLaneOf(
  data: ColorFunctionInputs,
  { lengthOf, trackId }: FilterExtras = {},
) {
  return (field: string): PredicateLane | undefined => {
    switch (field) {
      case 'length':
        return lengthOf ? { kind: 'get', get: lengthOf } : undefined
      case 'track':
        return trackId === undefined
          ? undefined
          : { kind: 'get', get: () => trackId }
      case 'strand':
        return { kind: 'number', values: data.strands }
      case 'query':
        return {
          kind: 'labels',
          ids: data.refNameIds,
          labels: data.refNameDict,
        }
      case 'target':
        return {
          kind: 'labels',
          ids: data.mateRefNameIds,
          labels: data.mateRefNameDict,
        }
    }
    const attribute = attributeOf(field)
    const values = data.attributes[attribute]
    if (!values) {
      return undefined
    }
    const range = data.attributeRanges[attribute]
    return range && isAttributeLabels(range)
      ? { kind: 'labels', ids: values, labels: range.labels }
      : { kind: 'number', values }
  }
}

/** The records a comparative `filter` admits, or undefined to admit all. */
export function comparativeFilter(
  predicates: readonly FieldPredicate[] | undefined,
  data: ColorFunctionInputs,
  extras?: FilterExtras,
) {
  return predicates?.length
    ? compilePredicates(predicates, comparativeLaneOf(data, extras))
    : undefined
}
