import { MIN_GROW_HEIGHT } from '@jbrowse/plugin-features/band'

import { recordsCellData, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { BandRecord } from './recordsBand.fixture.ts'

const SPARSE: BandRecord[] = [
  ['rs1', 1000, 1001, 'A -> G', ''],
  ['rs2', 3000, 3002, 'AT -> A', ''],
]

// 40 records piled on one span: a `full` stack past the 200px slot
const PILE: BandRecord[] = Array.from({ length: 40 }, (_, i) => [
  `p${i}`,
  100,
  1500 + i,
  '<DEL>',
  'DEL',
])

const NO_ROWS = false

describe('with no rows the first layout sizes the track once', () => {
  test('a sparse window opens at its stack, under the slot height', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS)
    expect(display.height).toBeGreaterThanOrEqual(MIN_GROW_HEIGHT)
    expect(display.height).toBeLessThan(200)
    expect(display.scrollableHeight).toBe(0)
    expect(display.recordsFitStage).toMatchObject({ level: 'full', scale: 1 })
  })

  test('a dense window opens at the slot height and fits its stack in', () => {
    const { display } = recordsDisplayAt(PILE, 1, {}, NO_ROWS)
    expect(display.height).toBe(200)
    expect(display.recordsFitStage.scale).toBeLessThan(1)
  })

  test('a pan into a denser window keeps the height', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS)
    const opened = display.height
    display.view.setNewView(1, 0)
    display.setCellData(recordsCellData(PILE), [0])
    expect(display.height).toBe(opened)
    expect(display.recordsFitStage.scale).toBeLessThan(1)
  })

  test('a pan from a dense window into a sparse one keeps the height', () => {
    const { display } = recordsDisplayAt(PILE, 1, {}, NO_ROWS)
    display.view.setNewView(10, 0)
    display.setCellData(recordsCellData(SPARSE), [0])
    expect(display.height).toBe(200)
  })

  test('a resize holds across later loads', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS)
    const opened = display.height
    display.resizeHeight(40)
    display.setCellData(recordsCellData(PILE), [0])
    display.setCellData(recordsCellData(SPARSE), [0])
    expect(display.height).toBe(opened + 40)
  })

  test('the double click still sizes to the whole stack', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS, {
      heightMode: 'fixed',
    })
    display.view.setNewView(1, 0)
    display.setCellData(recordsCellData(PILE), [0])
    const stack = display.scrollContentHeight
    expect(stack).toBeGreaterThan(200)
    display.expandToContentHeight()
    expect(display.height).toBe(stack)
  })

  test('an empty window keeps the slot height until a record lands', () => {
    const { display } = recordsDisplayAt([], 10, {}, NO_ROWS)
    expect(display.height).toBe(200)
    display.setCellData(recordsCellData(SPARSE), [0])
    expect(display.height).toBeLessThan(200)
  })
})

describe('the first layout keeps the height it has', () => {
  test('a height the config or session wrote', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS, {
      height: 150,
    })
    expect(display.height).toBe(150)
  })

  test('over genotype rows, and after genotypes go off', () => {
    const { display } = recordsDisplayAt(SPARSE, 10)
    expect(display.recordsOnly).toBe(false)
    expect(display.height - display.topBands.recordsHeight).toBe(200)
    display.setShowGenotypes(false)
    expect(display.recordsOnly).toBe(true)
    expect(display.height).toBe(200)
  })

  test('under grow, which follows its records itself', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS, {
      heightMode: 'grow',
    })
    expect(display.height).toBeLessThan(200)
    expect(display.configuredHeight).toBe(200)
  })
})
