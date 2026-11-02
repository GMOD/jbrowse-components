import { recordsDrawnAlone } from '../../../linear-genome-view/src/LinearGenomeView/rExport/exportLinearView.ts'
import { recordsDisplayAt } from './recordsBand.fixture.ts'

import type { BandRecord } from './recordsBand.fixture.ts'

const FEW: BandRecord[] = [
  ['rs1', 1000, 1001, 'A -> G', ''],
  ['sv1', 2000, 9000, '<DEL> 7Kbp', 'DEL'],
]

describe('the R export reads a real variant display', () => {
  test('with no samples, as its records at their drawn height', () => {
    const { display } = recordsDisplayAt(FEW, 10, {}, false)
    expect(recordsDrawnAlone(display)).toEqual({
      height: display.topBands.reserved.records,
      fits: false,
    })
  })

  test('with genotypes hidden, as its records fitted into that height', () => {
    const { display } = recordsDisplayAt(FEW, 10, {}, true, {
      genotypes: { show: false },
    })
    expect(recordsDrawnAlone(display)).toEqual({
      height: display.topBands.reserved.records,
      fits: true,
    })
  })

  test('with genotype rows drawn, as a variant track', () => {
    const { display } = recordsDisplayAt(FEW, 10)
    expect(recordsDrawnAlone(display)).toBeUndefined()
  })
})
