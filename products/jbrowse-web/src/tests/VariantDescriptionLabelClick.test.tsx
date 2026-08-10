import '@testing-library/jest-dom'

import { fireEvent, screen } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// only the track this suite opens, so createView doesn't mount a
// selector row for the other ~120 - see volvoxConfigWithTracks
const config = volvoxConfigWithTracks(['volvox_test_vcf'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }
const opts = [{}, delay]

// The variant at ctgA:6285 has an empty ID (".") so its name label is blank and
// the only visible floating label is the description ("C -> T"). Clicking it
// must open the feature-details widget (with the per-sample genotype table).
// Regression: description labels were rendered without an onClick.
test('clicking a variant description label opens feature details', async () => {
  const { view, findByTestId } = await createView(config)

  await view.navToLocString('ctgA:6257..6305')
  fireEvent.click(await screen.findByTestId(hts('volvox_test_vcf'), ...opts))
  await findAnyDisplayPainted(delay)

  fireEvent.click(await screen.findByTestId('feature-desc-C -> T', ...opts))

  // BaseCard-Samples only renders when the genotype rows parsed, so its presence
  // confirms both that the widget opened and that the samples are populated.
  expect(await findByTestId('BaseCard-Samples', ...opts)).toBeInTheDocument()
}, 60000)
