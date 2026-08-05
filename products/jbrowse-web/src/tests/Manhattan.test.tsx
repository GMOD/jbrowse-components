import { fireEvent } from '@testing-library/react'

import { createView, doBeforeEach, hts, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const timeout = 20000

// The manhattan display had no render coverage outside the browser suites, so
// nothing local exercised how it registers its component — it used to reach the
// body through the model's `DisplayMessageComponent` getter and now composes
// `DisplayContainer` directly. Both first-paint testids are asserted because
// they answer to different suites: `manhattan-display-done` from DisplayChrome
// (cypress, website screenshot specs) and the generic
// `display-${displayId}-done` from the container (puppeteer's browser-tests wait
// on the `display-${trackId}` prefix). See DISPLAYCHROME.md, "Three testid
// shapes coexist".
test('open a GWAS manhattan track', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_gwas'), {}, { timeout }))

  await findByTestId('manhattan-display-done', {}, { timeout })
  await findByTestId(
    'display-volvox_gwas-LinearManhattanDisplay-done',
    {},
    { timeout },
  )
}, 25000)
