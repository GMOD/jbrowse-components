import { fireEvent } from '@testing-library/react'

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
const config = volvoxConfigWithTracks(['volvox_gwas'])

beforeEach(() => {
  doBeforeEach()
})

const timeout = 20000

// The Manhattan display registers the mark display's component, which nothing
// else local exercises under another display's model. Asserting the testid,
// display id and phase land on one element is what makes that verifiable here
// rather than only in a full GPU + headless-Chrome run. See DISPLAYCHROME.md
// §"One element per display".
test('open a GWAS manhattan track', async () => {
  const { view, findByTestId } = await createView(config)
  view.setNewView(5, 0)
  fireEvent.click(await findByTestId(hts('volvox_gwas'), {}, { timeout }))

  const el = await findDisplayPainted('mark-display', { timeout })
  expect(el.dataset.displayId).toBe('volvox_gwas-LinearManhattanDisplay')
  expect(el.dataset.displayDrawn).toBe('true')
}, 25000)
