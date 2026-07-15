import { findByTestId, navigateToUrl, waitForDataLoaded } from '../helpers.ts'
import { dualSnapshot, pageSnapshot } from '../snapshot.ts'

import type { TestCase, TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

// Both tracks render a pileup whose paint-complete element is
// pileup-display-done; each config gets a targeted-canvas test and a full-page
// test.
function pileupTests(
  label: string,
  config: string,
  snapshot: string,
): TestCase[] {
  const done = 'pileup-display-done'
  const load = async (page: Page) => {
    await navigateToUrl(page, `config=${config}`)
    await findByTestId(page, done, 60000)
    await waitForDataLoaded(page)
  }
  return [
    {
      name: `${label} color-by mode renders`,
      fn: async page => {
        await load(page)
        await dualSnapshot(
          page,
          `${snapshot}-pileup-canvas`,
          `[data-testid="${done}"] canvas`,
        )
      },
    },
    {
      name: `${label} full page screenshot`,
      fn: async page => {
        await load(page)
        await pageSnapshot(page, `${snapshot}-fullpage`)
      },
    },
  ]
}

const suite: TestSuite = {
  name: 'Methylation and Modifications',
  tests: [
    ...pileupTests(
      'methylation',
      'test_data/methylation_test/config.json',
      'methylation',
    ),
    ...pileupTests(
      'modifications',
      'test_data/modifications_test/config.json',
      'modifications',
    ),
  ],
}

export default suite
