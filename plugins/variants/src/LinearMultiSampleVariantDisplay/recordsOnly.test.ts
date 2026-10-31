import { resolveSubMenu } from '@jbrowse/core/ui'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'

import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { LinearMultiSampleVariantDisplayModel } from './model.ts'
import type { BandRecord } from './recordsBand.fixture.ts'
import type { MenuItem } from '@jbrowse/core/ui'

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

  test('the band draws every record, an SV in its class color and the rest in the feature track default, keying the SV classes alone', () => {
    const { display: d } = recordsDisplayAt(FEW, 10, {}, rows, display)
    const data = d.recordsRenderDataMap.get(0)!
    const colorOf = new Map(
      data.flatbushItems.map((item, i) => [item.featureId, data.rectColors[i]]),
    )
    expect([...colorOf.keys()].sort()).toEqual(['rs1', 'rs2', 'sv1'])
    expect(colorOf.get('rs1')).toBe(getCachedABGR(featureDefaultColor))
    expect(colorOf.get('rs2')).toBe(getCachedABGR(featureDefaultColor))
    expect(colorOf.get('sv1')).toBe(getCachedABGR('#e41a1c'))
    expect(d.colorScales).toMatchObject([
      { title: 'SV type', entries: [{ label: 'Deletion' }] },
    ])
  })

  test('with no SV among the records, nothing is keyed', () => {
    const { display: d } = recordsDisplayAt(
      FEW.filter(([id]) => id !== 'sv1'),
      10,
      {},
      rows,
      display,
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

test('over genotype rows grow keeps a slot height past growMaxHeight', () => {
  const { display } = recordsDisplayAt(PILE, 1, {}, true, {
    heightMode: 'grow',
    growMaxHeight: 120,
  })
  expect(display.growMaxHeight).toBe(Number.POSITIVE_INFINITY)
  expect(display.height).toBe(200)
})

test('genotypes.show off asks the worker for no sample', () => {
  const { display } = recordsDisplayAt(FEW, 10, {}, true, {
    genotypes: { show: false },
  })
  expect(display.rpcProps().sampleFilter).toEqual([])
  display.setShowGenotypes(true)
  expect(display.rpcProps().sampleFilter).toEqual(['S0'])
})

function labelsOf(items: MenuItem[]) {
  return items.flatMap(i =>
    'label' in i && typeof i.label === 'string' ? [i.label] : [],
  )
}

function subMenuLabels(items: MenuItem[], label: string) {
  const item = items.find(
    i =>
      'label' in i && typeof i.label === 'string' && i.label.startsWith(label),
  )
  return item && 'subMenu' in item ? labelsOf(resolveSubMenu(item)) : []
}

describe('the track menu', () => {
  const menu = (display: LinearMultiSampleVariantDisplayModel) =>
    display.trackMenuItems()

  test('genotypes off drops the allele-count filters, which read no rows', () => {
    const rows = recordsDisplayAt(FEW, 10).display
    expect(subMenuLabels(menu(rows), 'Filter by')).toEqual(
      expect.arrayContaining(['Minor allele frequency', 'Missingness']),
    )
    const off = recordsDisplayAt(FEW, 10, {}, true, {
      genotypes: { show: false },
    }).display
    expect(labelsOf(menu(off))).not.toContain('Filter by')
    expect(subMenuLabels(menu(off), 'Filter by')).not.toContain('Missingness')
  })

  test('genomic positions offer Genotype rows, and with none Feature height', () => {
    const off = recordsDisplayAt(FEW, 10, {}, true, {
      genotypes: { show: false },
    }).display
    expect(subMenuLabels(menu(off), 'Show')).toContain('Genotype rows')
    expect(labelsOf(menu(off))).not.toContain('Row height')
    expect(subMenuLabels(menu(off), 'Feature height')).toEqual([
      'Normal',
      'Compact',
      'Super-compact',
      'Collapsed',
      'Track sizing',
      'Fixed feature height + fixed track height',
      'Fixed feature height + autogrow track height',
      'Fit feature height to track height',
    ])
  })

  test('columns offer neither', () => {
    const { display } = recordsDisplayAt(FEW, 10, {}, true, {
      genotypes: { show: false },
      variantLayout: 'columns',
    })
    expect(subMenuLabels(menu(display), 'Show')).not.toContain('Genotype rows')
    expect(labelsOf(menu(display))).not.toContain('Feature height')
  })
})
