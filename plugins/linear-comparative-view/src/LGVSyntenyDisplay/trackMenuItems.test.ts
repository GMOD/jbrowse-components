import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

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
  return subMenu(display.trackMenuItems() as MenuItem[], 'Color by...').filter(
    i => 'type' in i && i.type === 'radio',
  )
}

test('the curated colour schemes are the four synteny ones', () => {
  expect(
    colorRows(createDisplay()).map(i => ('label' in i ? i.label : undefined)),
  ).toEqual(['Normal', 'Strand', 'Mapping quality', 'Query name'])
})

// An all-vs-all track stacks one section per mate assembly, so this display
// inherits the alignments base's `groupBy.domain` and has to offer the same
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

function sectionRows(display: ReturnType<typeof createDisplay>) {
  return subMenu(display.trackMenuItems() as MenuItem[], 'Sections')
}

test('no Sections menu until a second mate-assembly lane is fetched', () => {
  const display = createDisplay()
  expect(
    (display.trackMenuItems() as MenuItem[]).some(
      i => 'label' in i && i.label === 'Sections',
    ),
  ).toBe(false)
  display.setGroupBy({ type: 'mateAssembly' })
  seedSections(display, ['volvox_random'])
  expect(
    (display.trackMenuItems() as MenuItem[]).some(
      i => 'label' in i && i.label === 'Sections',
    ),
  ).toBe(false)
})

test('Move down on a lane writes the drawn order as the domain', () => {
  const display = createDisplay({
    trackAssemblyNames: ['volvox', 'volvox_random', 'volvox_two'],
  })
  display.setGroupBy({ type: 'mateAssembly' })
  seedSections(display, ['volvox_random', 'volvox_two'])
  expect(
    sectionRows(display).map(i => ('label' in i ? i.label : undefined)),
  ).toEqual(['volvox_random', 'volvox_two', 'Reset section order'])

  const moveDown = subMenu(sectionRows(display), 'volvox_random')[1] as {
    onClick: () => void
  }
  moveDown.onClick()
  expect(display.groupBy).toEqual({
    type: 'mateAssembly',
    domain: ['volvox_two', 'volvox_random'],
  })
  expect(display.groupOrder.map((g: { key: string }) => g.key)).toEqual([
    'volvox_two',
    'volvox_random',
  ])
})
