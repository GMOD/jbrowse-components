import { fireEvent } from '@testing-library/react'

import { createView, doBeforeEach, hts, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 20000

// The manhattan display has no render coverage outside the browser suites, so
// nothing local exercises how it registers its component — it reached the body
// through the model's `DisplayMessageComponent` getter, then through a
// `DisplayContainer` wrapper, and now registers its body directly. Asserting the
// testid, display id and phase land on one element is what makes that last move
// verifiable here rather than only in a full GPU + headless-Chrome run. See
// DISPLAYCHROME.md, "One element per display".
test('open a GWAS manhattan track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_gwas'), {}, { timeout }))

  const el = await findByTestId('manhattan-display-done', {}, { timeout })
  expect(el.getAttribute('data-display-id')).toBe(
    'volvox_gwas-LinearManhattanDisplay',
  )
  expect(el.getAttribute('data-display-drawn')).toBe('true')
}, 25000)
