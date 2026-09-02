import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

import type { Source } from './types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

// "Group by..." is the ordering twin of "Color by... → Samples": same candidate
// attributes off the samplesTsv columns, writing the `groupBy` slot instead of
// `colorBy`. The user guide has always described grouping as interactive; only
// the config slot was.
function display(sources?: Source[]) {
  const { display } = createTestEnvironment().createDisplay()
  if (sources) {
    display.setSources(sources)
  }
  return display
}

function groupBySubMenu(d: ReturnType<typeof display>): MenuItem[] {
  const item = d
    .trackMenuItems()
    .find(i => 'label' in i && i.label === 'Group by...')
  return item && 'subMenu' in item ? item.subMenu : []
}

const SOURCES = [
  { name: 'HG001', population: 'EUR', sex: 'M' },
  { name: 'HG002', population: 'AFR', sex: 'F' },
  { name: 'HG003', population: 'EUR', sex: 'M' },
]

test('offers None plus every sample attribute', () => {
  expect(
    groupBySubMenu(display(SOURCES)).map(i => 'label' in i && i.label),
  ).toEqual(['None', 'Population', 'Sex'])
})

test('nothing to group by means no row at all', () => {
  expect(groupBySubMenu(display([{ name: 'HG001' }]))).toEqual([])
})

test('picking an attribute groups the rows and ticks itself', () => {
  const d = display(SOURCES)
  const population = groupBySubMenu(d)[1]!
  expect('checked' in population && population.checked).toBe(false)
  if ('onClick' in population) {
    population.onClick()
  }

  expect(d.groupBy).toBe('population')
  // EUR has two members, so it leads
  expect(d.layout.map(s => s.name)).toEqual(['HG001', 'HG003', 'HG002'])
  const next = groupBySubMenu(d)[1]!
  expect('checked' in next && next.checked).toBe(true)
})

test('None turns the grouping off', () => {
  const d = display(SOURCES)
  d.setGroupBy('population')
  const none = groupBySubMenu(d)[0]!
  if ('onClick' in none) {
    none.onClick()
  }
  expect(d.groupBy).toBe('')
})
