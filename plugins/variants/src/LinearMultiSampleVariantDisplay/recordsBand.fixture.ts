import {
  cellDataOf,
  cellPayloadOf,
  featureInfoOf,
} from '../shared/cellDataFixtures.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { CellDataResult } from '../VariantRPC/executeVariantCellData.ts'
import type { VariantFeatureInfo } from '../shared/types.ts'

export type BandRecord = [
  id: string,
  start: number,
  end: number,
  description: string,
  svType?: string,
  // what the worker read off the record beyond these
  info?: Partial<VariantFeatureInfo>,
]

// The bovine pangenome's records at KIT (chr6:70,080,000), rebased to 0: a long
// record with nested ones inside it.
export const KIT: BandRecord[] = [
  ['>7493>7494', 3197, 3198, 'A -> 74bp'],
  ['>7494>7499', 19508, 40130, '20.6Kbp -> 1bp,37.5Kbp'],
  ['>7495>7496', 19532, 19533, '20.6Kbp,34Kbp,37.5Kbp -> 1.86Kbp'],
  ['>7496>7497', 24561, 24562, 'A -> 14.3Kbp'],
  ['>7497>7498', 34261, 34262, 'A -> 743bp'],
  ['>7499>7501', 47595, 47646, '51bp -> A'],
  ['>7501>7503', 77624, 77635, '11bp -> 91bp'],
]

// The same at TAS2R46 (chr5:98,575,000).
export const TAS2R46: BandRecord[] = [
  ['>10042>10043', 9281, 9282, 'T -> 90bp'],
  ['>10043>10050', 12383, 29403, '17Kbp -> 18Kbp,C'],
  ['>10044>10046', 16668, 16727, '59bp -> A'],
  ['>10046>10047', 18057, 18058, 'T -> 661bp'],
  ['>10047>10048', 18553, 18554, 'C -> 282bp'],
  ['>10048>10049', 19842, 19843, 'A -> 73bp'],
]

export function recordsCellData(records: BandRecord[]): CellDataResult {
  return cellDataOf({
    samplePloidy: { S0: 2 },
    rowNames: ['S0'],
    sampleNames: ['S0'],
    genotypeDict: ['0|1'],
    simplifiedFeatures: records.map(([id, start, end]) => ({
      id,
      data: { start, end, refName: 'ctgA', name: id },
    })),
    perRegionCellData: {
      0: cellPayloadOf(
        records.map(([id, start, end, description, svType = 'DEL', info]) =>
          featureInfoOf(id, {
            description,
            length: end - start,
            svType,
            svAlleles: [svType !== ''],
            genotypeCodes: Uint32Array.of(1),
            ...info,
          }),
        ),
        {
          featurePositions: Uint32Array.from(
            records.flatMap(([, start, end]) => [start, end]),
          ),
        },
      ),
    },
  })
}

// The figures' 1400px viewport, whose track is ~1960 px wide.
export function recordsDisplayAt(
  records: BandRecord[],
  bpPerPx: number,
  band: Record<string, unknown> = {},
  // the one sample, S0, drawn as a row; false for a sites-only display
  rows = true,
  display: Record<string, unknown> = {},
) {
  const env = createTestEnvironment({
    displayConfig: { records: { show: true, ...band }, ...display },
  }).createDisplay()
  env.display.view.setWidth(1960)
  env.display.view.setNewView(bpPerPx, 0)
  env.display.setSources(rows ? [{ name: 'S0' }] : [])
  env.display.setCellData(recordsCellData(records), [0])
  return env
}
