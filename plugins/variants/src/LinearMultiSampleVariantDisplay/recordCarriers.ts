import { GENOTYPE_SPLITTER } from '../shared/constants.ts'
import { isNoCall } from '../shared/getPhasedColor.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'

/**
 * People, not haplotypes: a sample counts once, however many alts it carries.
 * Every shown sample is one of the three, so their sum is the denominator.
 */
export interface RecordCarriers {
  carriers: number
  nonCarriers: number
  noCall: number
}

// Once per interned genotype string: the ALT indices it calls (1 is ALT1),
// undefined for a no-call, so the per-sample walk parses nothing.
function genotypeAltIndices(dict: readonly string[]) {
  return dict.map(genotype =>
    isNoCall(genotype)
      ? undefined
      : genotype
          .split(GENOTYPE_SPLITTER)
          .filter(allele => allele !== '.' && allele !== '0')
          .map(Number),
  )
}

function countRecord(
  codes: Uint32Array,
  columns: readonly number[],
  altIndices: readonly (number[] | undefined)[],
  svAlleles: readonly boolean[],
): RecordCarriers {
  let carriers = 0
  let nonCarriers = 0
  let noCall = 0
  for (const column of columns) {
    const code = codes[column]!
    const called = code === 0 ? undefined : altIndices[code - 1]
    if (called === undefined) {
      noCall++
    } else if (called.some(alt => svAlleles[alt - 1])) {
      carriers++
    } else {
      nonCarriers++
    }
  }
  return { carriers, nonCarriers, noCall }
}

/**
 * Each SV record's carriers among `samples`: a sample calling one of its
 * structural ALT alleles carries it, so a small allele beside them at an
 * un-decomposed site does not. One with no called allele is a no-call, which
 * still counts toward the samples.
 */
export function countRecordCarriers(
  cellData: CellDataResult,
  samples: readonly string[],
) {
  const columnOf = new Map(cellData.sampleNames.map((name, i) => [name, i]))
  const columns = samples.flatMap(name => {
    const column = columnOf.get(name)
    return column === undefined ? [] : [column]
  })
  const altIndices = genotypeAltIndices(cellData.genotypeDict)
  const out = new Map<string, RecordCarriers>()
  for (const data of Object.values(cellData.perRegionCellData)) {
    for (const info of data.featureInfo) {
      if (info.svType !== '' && !out.has(info.featureId)) {
        out.set(
          info.featureId,
          countRecord(info.genotypeCodes, columns, altIndices, info.svAlleles),
        )
      }
    }
  }
  return out
}

function sampleCount({ carriers, nonCarriers, noCall }: RecordCarriers) {
  return carriers + nonCarriers + noCall
}

/** "17%" of every shown sample, "<1%" for a carrier that rounds to none. */
export function carrierPercent(c: RecordCarriers) {
  const samples = sampleCount(c)
  const percent = Math.round((100 * c.carriers) / samples)
  return samples === 0
    ? ''
    : c.carriers > 0 && percent === 0
      ? '<1%'
      : `${percent}%`
}

/** "538 of 3,202 samples (17%); 1 non-carrier, 2,663 no-call" */
export function carrierSummary(c: RecordCarriers) {
  const count = (n: number) => n.toLocaleString('en-US')
  const nonCarriers = `${count(c.nonCarriers)} non-carrier${c.nonCarriers === 1 ? '' : 's'}`
  const noCall = c.noCall > 0 ? `, ${count(c.noCall)} no-call` : ''
  return `${count(c.carriers)} of ${count(sampleCount(c))} samples (${carrierPercent(c)}); ${nonCarriers}${noCall}`
}
