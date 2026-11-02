import { setConf } from '@jbrowse/core/configuration'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
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
    expect(display.availableHeight).toBe(200)
    display.setShowGenotypes(false)
    expect(display.recordsOnly).toBe(false)
    expect(display.configuredHeight).toBe(200)
  })

  test('under grow, which follows its records itself', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS, {
      heightMode: 'grow',
    })
    expect(display.height).toBeLessThan(200)
    expect(display.configuredHeight).toBe(200)
  })
})

// SNVs past the density budget over rows, collapsing into one row, over a
// pile of DELs a zoom in stacks
const DENSE_OVER_PILE: BandRecord[] = [
  ...Array.from({ length: 4000 }, (_, i): BandRecord => [
    `s${i}`,
    100 + i * 5,
    101 + i * 5,
    'A -> G',
    '',
  ]),
  ...Array.from({ length: 30 }, (_, i): BandRecord => [
    `d${i}`,
    200,
    600 + i * 10,
    '<DEL>',
    'DEL',
  ]),
]

describe('over rows the band settles at a stack it packed', () => {
  test('not while the records collapse past the density budget', () => {
    const { display } = recordsDisplayAt(DENSE_OVER_PILE, 10)
    expect(display.recordsPackMode).toBe('collapsed')
    expect(display.recordsHeightHeld).toBe(false)
  })

  test('the zoom in that packs them settles it, every DEL shown', () => {
    const { display } = recordsDisplayAt(DENSE_OVER_PILE, 10)
    display.view.setNewView(0.5, 0)
    expect(display.recordsPackMode).toBe('compact')
    expect(display.recordsHeightHeld).toBe(true)
    expect(display.topBands.reserved.records).toBeGreaterThan(100)
  })
})

// the opening heights live on the display: opening a track edits no session,
// shows no track as overridden, and leaves Reset and undo nothing to fight
describe('an opening height writes nothing', () => {
  test('with no rows', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS)
    expect(display.height).toBeLessThan(200)
    expect(getSnapshot(display.configuration)).not.toHaveProperty('height')
  })

  test('over rows, for the band', () => {
    const { display } = recordsDisplayAt(SPARSE, 10)
    expect(display.topBands.reserved.records).toBeGreaterThan(0)
    expect(display.recordsHeightHeld).toBe(true)
    expect(display.recordsHeightWritten).toBe(false)
  })

  test('a drag starts from the opening height and writes where it ends', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS)
    const opened = display.height
    display.resizeHeight(10)
    expect(display.height).toBe(opened + 10)
    expect(getSnapshot(display.configuration).height).toBe(opened + 10)
  })

  test('a reset returns to the opening height', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS)
    const opened = display.height
    display.resizeHeight(40)
    display.view.setNewView(1, 0)
    display.setCellData(recordsCellData(PILE), [0])
    setConf(display, 'height', undefined)
    expect(display.height).toBe(opened)
  })

  test('a written height of the default holds', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, NO_ROWS, {
      height: 200,
    })
    expect(display.height).toBe(200)
  })
})

describe('a one-sample VCF opening as its records', () => {
  test('gives its row the default height once the row is asked for', () => {
    const { display } = recordsDisplayAt(SPARSE, 10, {}, true, {
      genotypes: {},
    })
    expect(display.recordsOnly).toBe(true)
    expect(display.height).toBeLessThan(200)
    display.setShowGenotypes(true)
    expect(display.recordsOnly).toBe(false)
    expect(display.availableHeight).toBe(200)
  })
})
