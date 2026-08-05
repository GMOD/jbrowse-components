import { fireEvent } from '@testing-library/react'

import { testOpenTrack } from './testOpenTrack.tsx'
import { createView, doBeforeEach, hts, setup } from './util.tsx'

setup()

const timeout = 20000

beforeEach(() => {
  doBeforeEach()
})

test('open a bigwig track', async () => {
  await testOpenTrack({
    bpPerPx: 5,
    start: 0,
    trackId: 'volvox_microarray',
  })
}, 25000)

test('open a bigwig line track 2', async () => {
  await testOpenTrack({
    bpPerPx: 10,
    start: 0,
    trackId: 'volvox_microarray_line',
  })
}, 25000)

test('open a bigwig density track', async () => {
  await testOpenTrack({
    bpPerPx: 5,
    start: 0,
    trackId: 'volvox_microarray_density',
  })
}, 25000)

// The wiggle display emits TWO first-paint testids and both are load-bearing:
// `wiggle-display-done` from DisplayChrome (cypress + the website screenshot
// specs pin the static base) and the generic `display-${displayId}-done` from
// the DisplayContainer its registered component composes (puppeteer's
// browser-tests wait on the `display-${trackId}` prefix for every feature/canvas
// track). The generic one is the half no local suite covered, so a change to how
// wiggle registers its component — it used to reach the body through the model's
// `DisplayMessageComponent` getter — could drop it and stay green until a full
// GPU + headless-Chrome run. See agent-docs/reference/DISPLAYCHROME.md, "Three
// testid shapes coexist".
test('a wiggle track emits both the chrome and container -done testids', async () => {
  const { view, findByTestId } = await createView()
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), {}, { timeout }))

  await findByTestId('wiggle-display-done', {}, { timeout })
  await findByTestId(
    'display-volvox_microarray-LinearWiggleDisplay-done',
    {},
    { timeout },
  )
}, 25000)
