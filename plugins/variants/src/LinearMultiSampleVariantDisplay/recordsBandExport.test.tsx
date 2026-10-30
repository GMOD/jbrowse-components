import { resolveSubMenu } from '@jbrowse/core/ui'
import { render } from '@testing-library/react'

import { createTestEnvironment as createMatrixTestEnvironment } from './matrix/testEnv.ts'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'
import { renderSvg } from './renderSvg.tsx'

import type { MenuItem } from '@jbrowse/core/ui'

jest.mock('@jbrowse/core/svg/svgReady', () => ({
  ...jest.requireActual('@jbrowse/core/svg/svgReady'),
  awaitSvgReady: () => Promise.resolve(),
}))

function recordsItem(items: MenuItem[]) {
  const show = items.find(i => 'label' in i && i.label === 'Show')
  const subMenu = show && 'subMenu' in show ? resolveSubMenu(show) : []
  return subMenu.find(i => 'label' in i && i.label === 'Records')
}

test('Show → Records toggles the band', () => {
  const { display } = recordsDisplayAt(KIT, 51, { show: false })
  const item = recordsItem(display.trackMenuItems())
  if (!item || !('type' in item) || item.type !== 'checkbox') {
    throw new Error('no "Records" checkbox in "Show"')
  }
  expect(item.checked).toBe(false)

  item.onClick()
  expect(display.showRecords).toBe(true)
  expect(display.topBands.recordsHeight).toBeGreaterThan(0)
})

test('the columns layout offers no records band', () => {
  const { display } = createMatrixTestEnvironment().createDisplay()
  expect(recordsItem(display.trackMenuItems())).toBeUndefined()
})

test('the export letters the records above rows moved down by the band', async () => {
  const { display } = recordsDisplayAt(KIT, 51)
  const { container } = render(<svg>{await renderSvg(display, {})}</svg>)
  const text = container.textContent
  for (const [id] of KIT) {
    expect(text).toContain(id)
  }
  const rowShifts = [...container.querySelectorAll('g[transform]')].map(g =>
    g.getAttribute('transform'),
  )
  expect(rowShifts).toContain(`translate(0 ${display.topBands.recordsHeight})`)
})
