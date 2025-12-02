import { makeSimpleAltString } from '../../VcfFeature/util'

import type { Filters, InfoFields, VariantSampleGridRow } from './types'

export function getSampleGridRows(
  samples: Record<string, InfoFields>,
  REF: string,
  ALT: string[],
  filter: Filters,
): {
  rows: VariantSampleGridRow[]
  error: unknown
} {
  let error: unknown
  let rows: VariantSampleGridRow[] = []
  const filterKeys = Object.keys(filter)

  try {
    rows = Object.entries(samples)
      .map(([key, val]) => {
        const gt = val.GT?.[0]
        return {
          ...val,
          ...(gt
            ? { GT: `${gt}`, genotype: makeSimpleAltString(`${gt}`, REF, ALT) }
            : {}),
          sample: key,
          id: key,
        } as VariantSampleGridRow
      })
      .filter(row =>
        filterKeys.length
          ? filterKeys.every(key => {
              const currFilter = filter[key]
              return currFilter
                ? new RegExp(currFilter, 'i').exec(row[key]!)
                : true
            })
          : true,
      )
  } catch (e) {
    console.error(e)
    error = e
  }

  return { rows, error }
}
