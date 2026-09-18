import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

import type { Source } from './types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// "Group rows by..." is the banding twin of "Color by... → Samples": same
// candidate attributes off the samplesTsv columns, writing the `facet.field`
// slot instead of `rowColor`. The user guide has always described the banding as
// interactive; only the config slot was.
function display(sources?: Source[]) {
  const { display } = createTestEnvironment().createDisplay()
  if (sources) {
    display.setSources(sources)
  }
  return display
}

function facetSubMenu(d: ReturnType<typeof display>): MenuItem[] {
  const item = d
    .trackMenuItems()
    .find(i => 'label' in i && i.label === 'Group rows by...')
  return item && 'subMenu' in item ? resolveSubMenu(item) : []
}

const SOURCES = [
  { name: 'HG001', population: 'EUR', sex: 'M' },
  { name: 'HG002', population: 'AFR', sex: 'F' },
  { name: 'HG003', population: 'EUR', sex: 'M' },
]

test('offers None plus every sample attribute', () => {
  expect(
    facetSubMenu(display(SOURCES)).map(i => 'label' in i && i.label),
  ).toEqual(['None', 'Population', 'Sex'])
})

test('nothing to band by means no row at all', () => {
  expect(facetSubMenu(display([{ name: 'HG001' }]))).toEqual([])
})

test('picking an attribute bands the rows and ticks itself', () => {
  const d = display(SOURCES)
  const population = facetSubMenu(d)[1]!
  expect('checked' in population && population.checked).toBe(false)
  if ('onClick' in population) {
    population.onClick()
  }

  expect(d.facet?.field).toBe('population')
  // No domain, so the bands sort: AFR before EUR, whatever their sizes. The
  // band is resolved on the read, so nothing lands in `layout`.
  expect(d.sources.map(s => s.name)).toEqual(['HG002', 'HG001', 'HG003'])
  expect(d.layout).toHaveLength(0)
  const next = facetSubMenu(d)[1]!
  expect('checked' in next && next.checked).toBe(true)
})

test('None turns the facet off', () => {
  const d = display(SOURCES)
  d.setFacet('population')
  const none = facetSubMenu(d)[0]!
  if ('onClick' in none) {
    none.onClick()
  }
  expect(d.facet).toBeUndefined()
})
