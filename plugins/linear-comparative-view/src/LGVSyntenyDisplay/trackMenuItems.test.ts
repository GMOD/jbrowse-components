import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

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
