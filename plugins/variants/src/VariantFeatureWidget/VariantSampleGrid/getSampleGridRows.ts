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
  const preFilteredRows = Object.entries(samples).map(([key, val]) => {
    const gt = val.GT?.[0]
    return [
      key,
      {
        ...val,
        ...(gt
          ? {
              GT: `${gt}`,
              genotype: makeSimpleAltString(`${gt}`, REF, ALT),
            }
          : {}),
      },
    ] as const
  })

  let error: unknown
  let rows = [] as VariantSampleGridRow[]
  const filters = Object.keys(filter)

  // catch some error thrown from regex
  // note: maps all values into a string, if this is not done rows are not
  // sortable by the data-grid
  try {
    rows = preFilteredRows
      .map(([key, val]) => {
        return {
          ...Object.fromEntries(
            Object.entries(val).map(([formatField, formatValue]) => [
              formatField,
              formatValue,
            ]),
          ),
          sample: key,
          id: key,
        } as VariantSampleGridRow
      })
      .filter(row =>
        filters.length
          ? filters.every(key => {
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
