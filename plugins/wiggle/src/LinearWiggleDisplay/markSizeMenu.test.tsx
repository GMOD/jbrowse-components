import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { render, within } from '@testing-library/react'

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
  const { container } = render(<>{sizeRow(items, label).render(() => {})}</>)
  return (await within(container).findByRole('button')).hasAttribute('disabled')
}

test('a line width leaves the point size at its default', async () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setMark('line')
  display.setStrokeWidth(5)
  expect(display.lineWidth).toBe(5)
  expect(await resetDisabled(display.trackMenuItems(), 'Line width')).toBe(
    false,
  )
  display.setMark('point')
  expect(display.size).toBe(2)
  expect(await resetDisabled(display.trackMenuItems(), 'Point size')).toBe(true)
})

test('a point size writes encoding.size and leaves the line width alone', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setPointSize(6)
  expect(display.size).toBe(6)
  expect(display.lineWidth).toBe(1)
})

test('a number written to encoding.size or strokeWidth lands in value', () => {
  const { createDisplay } = createTestEnvironment({
    displayConfig: { encoding: { size: 4, strokeWidth: 3 } },
  })
  const { display } = createDisplay()
  expect(display.size).toBe(4)
  expect(display.lineWidth).toBe(3)
})

test('an unset size reads as the default under either mark', async () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  display.setMark('line')
  expect(await resetDisabled(display.trackMenuItems(), 'Line width')).toBe(true)
})
