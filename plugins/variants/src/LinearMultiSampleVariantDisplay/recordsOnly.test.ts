import { featureDefaultColor } from '@jbrowse/core/ui/palette'

import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { BandRecord } from './recordsBand.fixture.ts'

// Records spread so the `full` stack is a few rows, well under 200px.
const FEW: BandRecord[] = [
  ['rs1', 1000, 1001, 'A -> G', ''],
  ['sv1', 2000, 9000, '<DEL> 7Kbp', 'DEL'],
  ['rs2', 3000, 3002, 'AT -> A', ''],
]

// One record per 2bp at 1bp/px overlapping in a pile 40 deep: a stack taller
// than the 200px slot.
const PILE: BandRecord[] = Array.from({ length: 40 }, (_, i) => [
  `p${i}`,
  100,
  1500 + i,
  '<DEL>',
  'DEL',
])

describe.each([
  ['a VCF with no samples', false, {}],
  ['genotypes.show off', true, { genotypes: { show: false } }],
])('%s', (_, rows, display) => {
  test('the rows take no height and the band is the display', () => {
    const { display: d } = recordsDisplayAt(FEW, 10, {}, rows, display)
    expect(d.recordsOnly).toBe(true)
    expect(d.topBands.recordsHeight).toBe(d.height)
    expect(d.availableHeight).toBe(0)
    expect(d.legendTop).toBe(0)
  })

  test('the band draws every record, in the feature track default color, with no key', () => {
    const { display: d } = recordsDisplayAt(FEW, 10, {}, rows, display)
    const data = d.recordsRenderDataMap.get(0)!
    expect(data.flatbushItems.map(i => i.featureId).sort()).toEqual([
      'rs1',
      'rs2',
      'sv1',
    ])
    expect(new Set(data.rectColors)).toEqual(
      new Set([getCachedABGR(featureDefaultColor)]),
    )
    expect(d.colorScales).toEqual([])
  })
})

test('genotype rows on keep the band over the rows, capped', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  expect(display.recordsOnly).toBe(false)
  expect(display.topBands.recordsHeight).toBeLessThan(display.height)
  expect(display.availableHeight).toBeGreaterThan(0)
})

describe('heightMode with no rows', () => {
  test('fit keeps the slot height and fits the stack into it', () => {
    const { display } = recordsDisplayAt(PILE, 1, {}, false)
    expect(display.heightMode).toBe('fit')
    expect(display.height).toBe(200)
    expect(display.topBands.recordsHeight).toBe(200)
    expect(display.recordsFitStage.scale).toBeLessThan(1)
  })

  test('grow sizes the track to its records, up to growMaxHeight', () => {
    const few = recordsDisplayAt(FEW, 10, {}, false, {
      heightMode: 'grow',
    }).display
    expect(few.height).toBeGreaterThanOrEqual(50)
    expect(few.height).toBeLessThan(200)
    const pile = recordsDisplayAt(PILE, 1, {}, false, {
      heightMode: 'grow',
    }).display
    expect(pile.height).toBeGreaterThan(200)
    expect(pile.topBands.recordsHeight).toBe(pile.height)
    const capped = recordsDisplayAt(PILE, 1, {}, false, {
      heightMode: 'grow',
      growMaxHeight: 120,
    }).display
    expect(capped.height).toBe(120)
  })

  test('fixed keeps the slot height and the stack at full size', () => {
    const { display } = recordsDisplayAt(PILE, 1, {}, false, {
      heightMode: 'fixed',
    })
    expect(display.height).toBe(200)
    expect(display.recordsFitStage).toMatchObject({ level: 'full', scale: 1 })
  })

  // What fixed or a capped grow cannot show scrolls, as on a feature track,
  // and the resize handle's double click grows the track to the stack.
  test('fixed scrolls the stack, and expands to it', () => {
    const { display } = recordsDisplayAt(PILE, 1, {}, false, {
      heightMode: 'fixed',
    })
    const stack = display.scrollContentHeight
    expect(stack).toBeGreaterThan(200)
    expect(display.scrollableHeight).toBe(stack - 200)
    display.setScrollTop(50)
    expect(display.recordsScrollTop).toBe(50)
    display.expandToContentHeight()
    expect(display.height).toBe(stack)
    expect(display.scrollableHeight).toBe(0)
  })

  test('fit squeezes the stack in and scrolls nothing', () => {
    const { display } = recordsDisplayAt(PILE, 1, {}, false)
    expect(display.scrollableHeight).toBe(0)
  })

  test('over genotype rows grow keeps the slot height', () => {
    const { display } = recordsDisplayAt(PILE, 1, {}, true, {
      heightMode: 'grow',
    })
    expect(display.height).toBe(200)
  })
})
