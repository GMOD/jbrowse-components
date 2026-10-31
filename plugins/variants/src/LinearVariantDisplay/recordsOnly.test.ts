import { resolveSubMenu } from '@jbrowse/core/ui'
import { featureDefaultColor } from '@jbrowse/core/ui/palette'

import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'
import { BAND_CHIPS_HEIGHT } from './variantTopBands.ts'

import type { LinearVariantDisplayModel } from './model.ts'
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
  test('the rows take no height', () => {
    const { display: d } = recordsDisplayAt(FEW, 10, {}, rows, display)
    expect(d.drawsRows).toBe(false)
    expect(d.availableHeight).toBe(0)
    expect(d.topBands.recordsHeight).toBeGreaterThan(0)
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

test('with no samples the band is the display', () => {
  const { display } = recordsDisplayAt(FEW, 10, {}, false)
  expect(display.recordsOnly).toBe(true)
  expect(display.topBands.recordsHeight).toBe(display.height)
})

// hidden rows leave the track the band, as it draws over them, and the strip
// holding the chip that brings them back; the slot keeps the rows' height
test('with genotypes hidden the track is the band and its chip strip', () => {
  const { display } = recordsDisplayAt(FEW, 10, {}, true, {
    genotypes: { show: false },
  })
  expect(display.recordsOnly).toBe(false)
  expect(display.recordsDisplayMode).toBe('compact')
  expect(display.height).toBe(
    display.topBands.recordsHeight + BAND_CHIPS_HEIGHT,
  )
  expect(display.configuredHeight).toBe(200)
  display.setShowGenotypes(true)
  expect(display.availableHeight).toBe(200)
})

// v4's `color1` lands as a constant `encoding.color.value`: every record
// paints it, and with no genotype drawn there is nothing for a key to name.
test('with no rows a constant color keys no genotype', () => {
  const { display } = recordsDisplayAt(
    FEW.filter(([id]) => id !== 'sv1'),
    10,
    {},
    false,
    { encoding: { color: { value: '#2c7bb6' } } },
  )
  expect(display.cellColorKeyed).toBe(false)
  expect(display.colorScales).toEqual([])
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
    expect(display.availableHeight).toBe(200)
  })
})

test('over genotype rows grow keeps a slot height past growMaxHeight', () => {
  const { display } = recordsDisplayAt(PILE, 1, {}, true, {
    heightMode: 'grow',
    growMaxHeight: 120,
  })
  expect(display.growMaxHeight).toBe(Number.POSITIVE_INFINITY)
  expect(display.availableHeight).toBe(200)
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
  const menu = (display: LinearVariantDisplayModel) => display.trackMenuItems()

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
    // the band sizes a track whose rows are hidden, so no track sizing
    expect(subMenuLabels(menu(off), 'Feature height')).toEqual([
      'Normal',
      'Compact',
      'Super-compact',
      'Collapsed',
    ])
    const noSamples = recordsDisplayAt(FEW, 10, {}, false).display
    expect(subMenuLabels(menu(noSamples), 'Feature height')).toContain(
      'Track sizing',
    )
  })

  test('rows hidden drop the rows, clustering and arrangement items', () => {
    const rows = recordsDisplayAt(FEW, 10).display
    const off = recordsDisplayAt(FEW, 10, {}, true, {
      genotypes: { show: false },
    }).display
    for (const label of ['Rows', 'Clustering', 'Edit colors/arrangement...']) {
      expect(labelsOf(menu(rows))).toContain(label)
      expect(labelsOf(menu(off))).not.toContain(label)
    }
  })

  // a phase set, a dosage and a sample color a cell, never a record
  test('with no rows Color by offers what paints a record', () => {
    const rows = recordsDisplayAt(FEW, 10).display
    const off = recordsDisplayAt(FEW, 10, {}, true, {
      genotypes: { show: false },
    }).display
    const noSamples = recordsDisplayAt(FEW, 10, {}, false).display
    expect(subMenuLabels(menu(rows), 'Color by')).toEqual(
      expect.arrayContaining(['Genotype']),
    )
    expect(
      subMenuLabels(menu(rows), 'Color by').some(l =>
        l.startsWith('Phase set'),
      ),
    ).toBe(true)
    for (const display of [off, noSamples]) {
      const labels = subMenuLabels(menu(display), 'Color by')
      expect(labels).toEqual(
        expect.arrayContaining(['Records', 'Default', 'Solid color...']),
      )
      for (const gone of ['Cells', 'Genotype', 'Samples']) {
        expect(labels).not.toContain(gone)
      }
      expect(labels.some(l => l.startsWith('Phase set'))).toBe(false)
    }
  })

  // columns lay out rows, so with none the configured columns would draw
  // nothing, and leave no way back to the rows but the Layout toggle
  test('columns configured with no rows draw the band at genomic positions', () => {
    const off = recordsDisplayAt(FEW, 10, {}, true, {
      genotypes: { show: false },
      variantLayout: 'columns',
    }).display
    const noSamples = recordsDisplayAt(FEW, 10, {}, false, {
      variantLayout: 'columns',
    }).display
    for (const display of [off, noSamples]) {
      expect(display.variantLayout).toBe('genomic')
      expect(display.topBands.recordsHeight).toBeGreaterThan(0)
      expect(display.rpcProps().layout).toBe('genomic')
      expect(labelsOf(menu(display))).not.toContain('Layout')
      expect(labelsOf(menu(display))).not.toContain('Row height')
    }
    expect(subMenuLabels(menu(off), 'Show')).toContain('Genotype rows')
    off.setShowGenotypes(true)
    expect(off.variantLayout).toBe('columns')
    expect(labelsOf(menu(off))).toContain('Layout')
  })

  test('columns offer Genotype rows, whose hiding falls back to the band', () => {
    const { display } = recordsDisplayAt(FEW, 10, {}, true, {
      variantLayout: 'columns',
    })
    expect(subMenuLabels(menu(display), 'Show')).toContain('Genotype rows')
    display.setShowGenotypes(false)
    expect(display.atGenomicPositions).toBe(true)
    expect(display.showRecords).toBe(true)
  })
})
