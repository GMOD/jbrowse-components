import { GENOTYPE_SPLITTER } from '../shared/constants.ts'
import { isNoCall } from '../shared/getPhasedColor.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { VariantFeatureInfo } from '../shared/types.ts'

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
  carriedAlleles: readonly boolean[],
): RecordCarriers {
  let carriers = 0
  let nonCarriers = 0
  let noCall = 0
  for (const column of columns) {
    const code = codes[column]!
    const called = code === 0 ? undefined : altIndices[code - 1]
    if (called === undefined) {
      noCall++
    } else if (called.some(alt => carriedAlleles[alt - 1])) {
      carriers++
    } else {
      nonCarriers++
    }
  }
  return { carriers, nonCarriers, noCall }
}

export type CountedRecord = Pick<
  VariantFeatureInfo,
  'featureId' | 'genotypeCodes' | 'svType' | 'alt' | 'svAlleles'
>

/**
 * A record's carriers among `samples`, counted when first asked and once per
 * record: a walk of every sample, which only a drawn label or a hover reads.
 * A sample calling any ALT carries a small variant; an SV only one calling a
 * structural ALT, so a small allele beside it at an un-decomposed site does
 * not. One with no called allele is a no-call, which still counts toward the
 * samples.
 */
export function recordCarrierCounter(
  cellData: Pick<CellDataResult, 'sampleNames' | 'genotypeDict'>,
  samples: readonly string[],
) {
  let walk:
    | { columns: number[]; altIndices: (number[] | undefined)[] }
    | undefined
  const counted = new Map<string, RecordCarriers>()
  return (info: CountedRecord) => {
    if (!walk) {
      const columnOf = new Map(cellData.sampleNames.map((name, i) => [name, i]))
      walk = {
        columns: samples.flatMap(name => {
          const column = columnOf.get(name)
          return column === undefined ? [] : [column]
        }),
        altIndices: genotypeAltIndices(cellData.genotypeDict),
      }
    }
    let carriers = counted.get(info.featureId)
    if (!carriers) {
      carriers = countRecord(
        info.genotypeCodes,
        walk.columns,
        walk.altIndices,
        info.svType === '' ? info.alt.map(() => true) : info.svAlleles,
      )
      counted.set(info.featureId, carriers)
    }
    return carriers
  }
}

export type RecordCarrierCounter = ReturnType<typeof recordCarrierCounter>

function sampleCount({ carriers, nonCarriers, noCall }: RecordCarriers) {
  return carriers + nonCarriers + noCall
}

/**
 * "17%" of every shown sample; "<1%" for a carrier that rounds to none, and
 * ">99%" short of every sample where it rounds to all.
 */
export function carrierPercent(c: RecordCarriers) {
  const samples = sampleCount(c)
  const percent = Math.round((100 * c.carriers) / samples)
  return samples === 0
    ? ''
    : c.carriers > 0 && percent === 0
      ? '<1%'
      : c.carriers < samples && percent === 100
        ? '>99%'
        : `${percent}%`
}

/** "538 of 3,202 samples (17%); 1 non-carrier, 2,663 no-call" */
export function carrierSummary(c: RecordCarriers) {
  const count = (n: number) => n.toLocaleString('en-US')
  const nonCarriers = `${count(c.nonCarriers)} non-carrier${c.nonCarriers === 1 ? '' : 's'}`
  const noCall = c.noCall > 0 ? `, ${count(c.noCall)} no-call` : ''
  return `${count(c.carriers)} of ${count(sampleCount(c))} samples (${carrierPercent(c)}); ${nonCarriers}${noCall}`
}
