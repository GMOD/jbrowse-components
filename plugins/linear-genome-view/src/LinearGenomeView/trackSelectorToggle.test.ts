import { createTestSession } from '@jbrowse/web/testUtils'

import type { LinearGenomeViewModel } from './index.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

function twoViews() {
  const session = createTestSession()
  const [a, b] = [0, 1].map(
    () => session.addView('LinearGenomeView', {}) as LinearGenomeViewModel,
  )
  return { session, a: a!, b: b! }
}

test("one view's open selector does not light up another view's button", () => {
  const { a, b } = twoViews()
  a.toggleTrackSelector()
  expect(a.isTrackSelectorOpen).toBe(true)
  expect(b.isTrackSelectorOpen).toBe(false)
})

test('toggling from a second view moves the selector to it rather than closing it', () => {
  const { session, a, b } = twoViews()
  a.toggleTrackSelector()
  b.toggleTrackSelector()
  expect(session.minimized).toBe(false)
  expect(session.visibleWidget?.view?.id).toBe(b.id)
  expect(a.isTrackSelectorOpen).toBe(false)
  expect(b.isTrackSelectorOpen).toBe(true)
  b.toggleTrackSelector()
  expect(b.isTrackSelectorOpen).toBe(false)
})
