import { altDosageByte, isNoCall } from '../shared/getPhasedColor.ts'

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

const REF = 0
const ALT = 1
const NO_CALL = 2

// once per interned genotype string, so the per-sample walk reads a byte
function genotypeClasses(dict: readonly string[]) {
  return Uint8Array.from(dict, genotype =>
    isNoCall(genotype) ? NO_CALL : altDosageByte(genotype) > 0 ? ALT : REF,
  )
}

function countRecord(
  codes: Uint32Array,
  columns: readonly number[],
  classes: Uint8Array,
): RecordCarriers {
  const counts = [0, 0, 0]
  for (const column of columns) {
    const code = codes[column]!
    const cls = code === 0 ? NO_CALL : classes[code - 1]!
    counts[cls] = counts[cls]! + 1
  }
  return {
    carriers: counts[ALT]!,
    nonCarriers: counts[REF]!,
    noCall: counts[NO_CALL]!,
  }
}

/**
 * Each SV record's carriers among `samples`: a sample with any called alt
 * allele carries it, and one with no called allele is a no-call, which still
 * counts toward the samples.
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
  const classes = genotypeClasses(cellData.genotypeDict)
  const out = new Map<string, RecordCarriers>()
  for (const data of Object.values(cellData.perRegionCellData)) {
    for (const info of data.featureInfo) {
      if (info.svType !== '' && !out.has(info.featureId)) {
        out.set(
          info.featureId,
          countRecord(info.genotypeCodes, columns, classes),
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
