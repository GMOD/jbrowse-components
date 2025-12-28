import { makeSimpleAltString } from '../../VcfFeature/util'

import type { Filters, InfoFields, VariantSampleGridRow } from './types'

function gtToAlleleCounts(gt: string) {
  const alleleCounts = {} as Record<string, number>
  const alleles = gt.split(/[/|]/)
  for (const allele of alleles) {
    alleleCounts[allele] = (alleleCounts[allele] || 0) + 1
  }
  return Object.entries(alleleCounts)
    .map(([key, val]) => `${key}:${val}`)
    .join(';')
}

export function getSampleGridRows(
  samples: Record<string, InfoFields>,
  REF: string,
  ALT: string[],
  filter: Filters,
  useCounts?: boolean,
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
        const gtStr = gt ? `${gt}` : undefined
        const displayGT = gtStr
          ? useCounts
            ? gtToAlleleCounts(gtStr)
            : gtStr
          : undefined
        return {
          ...val,
          ...(gtStr
            ? { GT: displayGT, genotype: makeSimpleAltString(gtStr, REF, ALT) }
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
