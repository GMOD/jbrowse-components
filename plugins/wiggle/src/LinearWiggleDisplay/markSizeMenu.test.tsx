import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { render, screen } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function sizeRow(items: MenuItem[], label: string) {
  const item = items.find(i => 'label' in i && i.label === label)
  if (!item || !('subMenu' in item)) {
    throw new Error(`no "${label}" submenu`)
  }
  const [row] = resolveSubMenu(item)
  if (!row || !('render' in row)) {
    throw new Error(`no slider row under "${label}"`)
  }
  return row
}

async function resetDisabled(items: MenuItem[], label: string) {
  render(<>{sizeRow(items, label).render(() => {})}</>)
  return (await screen.findByRole('button')).hasAttribute('disabled')
}

test('a line width carried into a scatter plot is its point size, not the default', async () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setMark('line')
  display.setSize(2)
  display.setMark('point')
  expect(display.size).toBe(2)
  expect(
    await resetDisabled(display.trackMenuItems(), 'Scatter point size'),
  ).toBe(false)
})

test('an unset size reads as the default under either mark', async () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setMark('line')
  expect(await resetDisabled(display.trackMenuItems(), 'Line width')).toBe(true)
})
