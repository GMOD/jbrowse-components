import { createTestSession } from '@jbrowse/web/testUtils'

import type { LinearGenomeViewModel } from './index.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function focusedView() {
  const session = createTestSession()
  const view = session.addView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50_000 },
    ],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  view.setWindow(8000, 10_000)
  session.setFocusedViewId(view.id)
  return view
}

function ctrlArrowUp() {
  const event = new KeyboardEvent('keydown', {
    code: 'ArrowUp',
    ctrlKey: true,
    cancelable: true,
  })
  document.dispatchEvent(event)
  return event
}

afterEach(() => {
  document.body.replaceChildren()
})

test('ctrl+arrow zooms the focused view', () => {
  focusedView()
  expect(ctrlArrowUp().defaultPrevented).toBe(true)
})

test('ctrl+arrow in a text field is left to the field', () => {
  focusedView()
  document.body.innerHTML = '<input />'
  document.querySelector('input')!.focus()
  expect(ctrlArrowUp().defaultPrevented).toBe(false)
})
