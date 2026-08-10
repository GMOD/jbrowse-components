import { fireEvent } from '@testing-library/react'

import { testOpenTrack } from './testOpenTrack.tsx'
import {
  createView,
  doBeforeEach,
  findDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_microarray'])

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

// The half no local suite used to cover. A wiggle track's first-paint testid,
// its display id and its phase must all land on ONE element: the website
// screenshot specs AND the puppeteer browser-tests both key off this element,
// and they used to key off two different ones (`wiggle-display-done` on
// DisplayChrome, `display-${displayId}-done` on a `DisplayContainer` wrapper).
// Collapsing that wrapper is invisible to jest unless the co-location is
// asserted, and the suites that would notice need a full GPU + headless-Chrome
// run. See agent-docs/reference/DISPLAYCHROME.md, "One element per display".
test('a wiggle track emits its testid, display id and phase on one element', async () => {
  const { view, findByTestId } = await createView(config)
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_microarray'), {}, { timeout }))

  const el = await findDisplayPainted('wiggle-display', { timeout })
  expect(el.dataset.displayId).toBe('volvox_microarray-LinearWiggleDisplay')
  expect(el.dataset.displayDrawn).toBe('true')
  expect(el.dataset.displayPhase).toBeTruthy()
}, 25000)
