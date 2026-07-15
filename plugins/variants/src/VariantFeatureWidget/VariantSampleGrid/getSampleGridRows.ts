import { makeSimpleAltString, resolveAllele } from '../../VcfFeature/util.ts'
import { GENOTYPE_SPLITTER } from '../../shared/constants.ts'

import type {
  AlleleFrequency,
  Filters,
  InfoFields,
  VariantSampleGridRow,
} from './types.ts'

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
    GT: gtStr
      ? useCounts
        ? countAlleles(gtStr, allele => allele)
        : gtStr
      : '',
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
  useCounts = false,
): VariantSampleGridRow[] {
  return Object.entries(samples).map(([sample, fields]) =>
    makeSampleGridRow(sample, fields, REF, ALT, useCounts),
  )
}

// Allele frequencies over all called alleles across samples. Missing ('.') and
// empty alleles are excluded from both the counts and the denominator (the
// standard AN/AC/AF definition), so a variant whose samples carry no GT call
// yields [] and the table simply doesn't render rather than showing a bogus
// all-ref result.
export function getAlleleFrequencies(
  samples: Record<string, InfoFields>,
  REF: string,
  ALT: string[],
): AlleleFrequency[] {
  const counts: Record<string, number> = {}
  let total = 0
  for (const sample in samples) {
    const gt = samples[sample]?.GT?.[0]
    if (gt) {
      for (const allele of `${gt}`.split(GENOTYPE_SPLITTER)) {
        if (allele && allele !== '.') {
          const key = resolveAllele(allele, REF, ALT)
          counts[key] = (counts[key] ?? 0) + 1
          total++
        }
      }
    }
  }
  return total === 0
    ? []
    : Object.entries(counts)
        .map(([allele, count]) => ({
          id: allele,
          allele,
          count,
          frequency: `${((count / total) * 100).toPrecision(3)}%`,
        }))
        .sort((a, b) => b.count - a.count)
}

// Applies the per-column case-insensitive regex filters to already-built rows.
// Separated from row building so an invalid regex (or a filter matching nothing)
// surfaces an error/empty result without discarding the rows the column and
// filter UI are derived from.
export function filterSampleRows(
  rows: VariantSampleGridRow[],
  filter: Filters,
): {
  rows: VariantSampleGridRow[]
  error: unknown
} {
  try {
    const compiledFilters = Object.keys(filter)
      .filter(k => filter[k])
      .map(k => ({ key: k, re: new RegExp(filter[k]!, 'i') }))
    return {
      rows: compiledFilters.length
        ? rows.filter(row =>
            compiledFilters.every(({ key, re }) => re.exec(row[key] ?? '')),
          )
        : rows,
      error: undefined,
    }
  } catch (e) {
    console.error(e)
    return { rows, error: e }
  }
}
