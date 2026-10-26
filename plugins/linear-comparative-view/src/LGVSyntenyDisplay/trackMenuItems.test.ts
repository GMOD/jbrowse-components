import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { moveSectionOnto } from '@jbrowse/display-kit/groupByMenu'
import { sectionOrderOf } from '@jbrowse/plugin-alignments'

import { makeEmptyPileupData } from '../../../alignments/src/LinearAlignmentsDisplay/testUtils.ts'
import { createDisplay } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function subMenu(items: MenuItem[], label: string): MenuItem[] {
  const found = items.find(i => 'label' in i && i.label === label)
  if (!found || !('subMenu' in found)) {
    throw new Error(`no "${label}" submenu`)
  }
  return resolveSubMenu(found)
}

function colorRows(display: ReturnType<typeof createDisplay>) {
  return subMenu(display.trackMenuItems() as MenuItem[], 'Color by').filter(
    i => 'type' in i && i.type === 'radio',
  )
}

test('the curated color schemes are the four synteny ones', () => {
  expect(
    colorRows(createDisplay()).map(i => ('label' in i ? i.label : undefined)),
  ).toEqual(['Strand', 'Mapping quality', 'Query', 'Solid color...'])
})

function featureHeightDisabled(display: ReturnType<typeof createDisplay>) {
  const item = (display.trackMenuItems() as MenuItem[]).find(
    i => 'label' in i && i.label === 'Feature height',
  )
  return item && 'disabled' in item ? item.disabled : undefined
}

test('the feature height menu greys out while the alignments are hidden', () => {
  const display = createDisplay()
  expect(featureHeightDisabled(display)).toBe(false)
  display.setShowPileup(false)
  expect(featureHeightDisabled(display)).toBe(true)
})

// `strand` paints only while the channel names neither a field nor a
// constant, so a written `value` is the fill and a written field wins over it.
test('a written value is the constant fill, over the strand default', () => {
  const display = createDisplay()
  expect(display.colorField).toBe('strand')
  display.applyPlot({ encoding: { color: { value: 'steelblue' } } })
  expect(display.colorField).toBeUndefined()
  expect(display.colorSetting.value).toBe('steelblue')
  display.colorByField('strand')
  expect(display.colorField).toBe('strand')
  display.applyPlot({
    encoding: { color: { value: 'steelblue', field: 'strand' } },
  })
  expect(display.colorField).toBe('strand')
  display.applyPlot({ encoding: { color: 'mapq' } })
  expect(display.colorField).toBe('mapq')
})

// An all-vs-all track stacks one section per mate assembly, so this display
// inherits the alignments base's `facet.sort` and has to offer the same
// reorder menu over it.
function seedSections(
  display: ReturnType<typeof createDisplay>,
  keys: string[],
) {
  display.setRpcData(
    0,
    {
      groups: keys.map(key => ({
        key,
        label: key,
        data: makeEmptyPileupData(),
      })),
    },
    { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
  )
}

function labelsOf(items: MenuItem[]) {
  return items.map(i => ('label' in i ? i.label : undefined))
}

test('a lane drop writes the drawn order as the domain, and Show offers the reset', () => {
  const display = createDisplay({
    trackAssemblyNames: ['volvox', 'volvox_random', 'volvox_two'],
  })
  display.facetByField('mateAssembly')
  seedSections(display, ['volvox_random', 'volvox_two'])
  const items = () => display.trackMenuItems() as MenuItem[]
  expect(labelsOf(items())).not.toContain('Sections')
  expect(labelsOf(subMenu(items(), 'Show'))).not.toContain(
    'Reset section order',
  )

  moveSectionOnto(sectionOrderOf(display)!, 'volvox_random', 'volvox_two')
  expect(display.facet).toEqual({
    field: 'mateAssembly',
    sort: ['volvox_two', 'volvox_random'],
  })
  expect(display.groupOrder.map((g: { key: string }) => g.key)).toEqual([
    'volvox_two',
    'volvox_random',
  ])
  expect(labelsOf(subMenu(items(), 'Show'))).toContain('Reset section order')
})
