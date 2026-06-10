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

// Build one grid row from a sample's FORMAT fields. Guarantees string `GT` and
// `genotype` (so the frequency table and genotype filter never key on
// undefined when a sample lacks a GT call) and flattens every other FORMAT
// array value to a string. The row then genuinely satisfies
// VariantSampleGridRow's string index signature instead of leaning on the grid
// and filter regex to stringify arrays at the point of use.
function makeSampleGridRow(
  sample: string,
  fields: InfoFields,
  REF: string,
  ALT: string[],
  useCounts: boolean,
): VariantSampleGridRow {
  const gt = fields.GT?.[0]
  const gtStr = gt ? `${gt}` : undefined
  const row: VariantSampleGridRow = {
    sample,
    id: sample,
    GT: gtStr ? (useCounts ? countAlleles(gtStr, allele => allele) : gtStr) : '',
    genotype: gtStr
      ? useCounts
        ? countAlleles(gtStr, allele => resolveAllele(allele, REF, ALT))
        : makeSimpleAltString(gtStr, REF, ALT)
      : '',
  }
  for (const key in fields) {
    if (key !== 'GT') {
      row[key] = `${fields[key] ?? ''}`
    }
  }
  return row
}

export function getSampleGridRows(
  samples: Record<string, InfoFields>,
  REF: string,
  ALT: string[],
  filter: Filters,
  useCounts = false,
): {
  rows: VariantSampleGridRow[]
  error: unknown
} {
  let error: unknown
  let rows: VariantSampleGridRow[] = []

  try {
    const compiledFilters = Object.keys(filter).map(k => ({
      key: k,
      re: filter[k] ? new RegExp(filter[k], 'i') : null,
    }))
    rows = Object.entries(samples)
      .map(([sample, fields]) =>
        makeSampleGridRow(sample, fields, REF, ALT, useCounts),
      )
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
