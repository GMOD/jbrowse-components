import { makeSimpleAltString, resolveAllele } from '../../VcfFeature/util.ts'
import { GENOTYPE_SPLITTER } from '../../shared/constants.ts'

import type { Filters, InfoFields, VariantSampleGridRow } from './types.ts'

function countAlleles(gt: string, resolve: (allele: string) => string) {
  const counts: Record<string, number> = {}
  for (const allele of gt.split(GENOTYPE_SPLITTER)) {
    const key = resolve(allele)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts)
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
    const compiledFilters = filterKeys.map(k => ({
      key: k,
      re: filter[k] ? new RegExp(filter[k], 'i') : null,
    }))
    rows = Object.entries(samples)
      .map(([key, val]) => {
        const gt = val.GT?.[0]
        const gtStr = gt ? `${gt}` : undefined
        const displayGT = gtStr
          ? useCounts
            ? countAlleles(gtStr, allele => allele)
            : gtStr
          : undefined
        const displayGenotype = gtStr
          ? useCounts
            ? countAlleles(gtStr, allele => resolveAllele(allele, REF, ALT))
            : makeSimpleAltString(gtStr, REF, ALT)
          : undefined
        return {
          ...val,
          ...(gtStr ? { GT: displayGT, genotype: displayGenotype } : {}),
          sample: key,
          id: key,
        } as VariantSampleGridRow
      })
      .filter(row =>
        compiledFilters.every(({ key, re }) =>
          re ? re.exec(row[key] ?? '') : true,
        ),
      )
  } catch (e) {
    console.error(e)
    error = e
  }

  return { rows, error }
}
