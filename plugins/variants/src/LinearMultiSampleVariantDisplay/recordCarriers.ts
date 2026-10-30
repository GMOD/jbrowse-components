import { altDosageByte, isNoCall } from '../shared/getPhasedColor.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'

/** People, not haplotypes: a sample counts once, however many alts it carries. */
export interface RecordCarriers {
  carriers: number
  called: number
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
  let carriers = 0
  let called = 0
  let noCall = 0
  for (const column of columns) {
    const code = codes[column]!
    const cls = code === 0 ? NO_CALL : classes[code - 1]!
    if (cls === NO_CALL) {
      noCall++
    } else {
      called++
      carriers += cls === ALT ? 1 : 0
    }
  }
  return { carriers, called, noCall }
}

/**
 * Each SV record's carriers among `samples`: a sample with any called alt
 * allele carries it, one with no called allele is a no-call and leaves the
 * denominator.
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

/** "41%", "<1%" for a carrier that rounds to none, '' with nobody called. */
export function carrierPercent({ carriers, called }: RecordCarriers) {
  const percent = Math.round((100 * carriers) / called)
  return called === 0
    ? ''
    : carriers > 0 && percent === 0
      ? '<1%'
      : `${percent}%`
}

/** "1,312 of 3,202 samples (41%)", and ", 5 no-call" when any. */
export function carrierSummary(c: RecordCarriers) {
  const count = (n: number) => n.toLocaleString('en-US')
  const noCall = c.noCall > 0 ? `, ${count(c.noCall)} no-call` : ''
  return `${count(c.carriers)} of ${count(c.called)} samples (${carrierPercent(c)})${noCall}`
}
