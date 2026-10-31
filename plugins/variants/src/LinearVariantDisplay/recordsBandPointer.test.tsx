import { getSession } from '@jbrowse/core/util'
import { fireEvent, render, screen } from '@testing-library/react'

import RecordsBandOverlay, {
  recordsBandSurface,
} from './components/RecordsBandOverlay.tsx'
import VariantTooltip from './components/VariantTooltip.tsx'
import { getTooltipRows } from './components/getTooltipRows.ts'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { LinearVariantDisplayModel } from './model.ts'

// The band's records answer the pointer as LinearBasicDisplay's features do.

function recordPoint(display: LinearVariantDisplayModel, id: string) {
  const item = display.recordsLaidOutDataMap
    .get(0)!
    .flatbushItems.find(i => i.featureId === id)!
  const { bpPerPx, offsetPx } = display.view
  return {
    clientX: (item.startBp + item.endBp) / 2 / bpPerPx - offsetPx,
    clientY: (item.topPx + item.bottomPx) / 2,
  }
}

function hoverRecord(display: LinearVariantDisplayModel, id: string) {
  const { clientX, clientY } = recordPoint(display, id)
  const surface = recordsBandSurface(display)
  return surface.getHit(clientX, clientY)!
}

test('a right-clicked record stays lit while its menu is open', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  render(<RecordsBandOverlay model={display} />)
  fireEvent.contextMenu(
    screen.getByTestId('records_band'),
    recordPoint(display, '>7495>7496'),
  )
  expect(display.contextMenuInfo?.bandRecordId).toBe('>7495>7496')
  expect(display.hoveredRecord).toBeUndefined()
  expect(display.hoverInk).toEqual(display.recordsInk(['>7495>7496']))
  expect(display.hoverInk.length).toBe(1)
  expect(display.highlightStyle).toBe('shade')
  display.closeContextMenu()
  expect(display.hoverInk).toEqual([])
  expect(display.highlightStyle).toBe('box')
})

test('the selected record is boxed, and a click on nothing clears it', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  render(<RecordsBandOverlay model={display} />)
  getSession(display).setSelection(display.featureById('>7494>7499')!)
  expect(display.selectionInk).toEqual(display.recordsInk(['>7494>7499']))
  expect(display.selectionInk.length).toBe(1)

  const empty = { clientX: 5, clientY: 5 }
  expect(
    recordsBandSurface(display).getHit(empty.clientX, empty.clientY),
  ).toBeUndefined()
  fireEvent.click(screen.getByTestId('records_band'), empty)
  expect(getSession(display).selection).toBeUndefined()
  expect(display.selectionInk).toEqual([])
})

// with no rows the band draws a record's ID and description as its labels,
// and its 20.6Kbp span is said nowhere else
test("a record's tooltip leaves out what its labels say", () => {
  const { display } = recordsDisplayAt(KIT, 51, {}, false)
  const surface = recordsBandSurface(display)
  const hit = hoverRecord(display, '>7494>7499')
  expect(display.recordsDrawnLabelTexts('>7494>7499')).toEqual(
    new Set([hit.fields.featureName, hit.fields.description]),
  )
  expect(getTooltipRows(surface.getTooltip(hit)).map(r => r.key)).toEqual([
    'length',
  ])
})

test('over rows the one label line leaves the tooltip whole', () => {
  const { display } = recordsDisplayAt(KIT, 51)
  const surface = recordsBandSurface(display)
  const hit = hoverRecord(display, '>7495>7496')
  expect(surface.getTooltip(hit)).toEqual(hit.fields)
})

test('a tooltip with nothing left draws no box', () => {
  const { container } = render(
    <VariantTooltip
      source={{ name: '', featureName: '', description: '' }}
      x={0}
      y={0}
    />,
  )
  expect(container.innerHTML).toBe('')
})
