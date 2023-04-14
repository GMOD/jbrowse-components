import '@testing-library/jest-dom/extend-expect'
import { waitFor } from '@testing-library/react'

import breakpointConfig from '../../test_data/breakpoint/config.json'
import { createView, doBeforeEach, mockConsoleWarn, setup } from './util'

setup()

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../test_data/breakpoint/${url}`))
})

const delay = { timeout: 10000 }

test(
  'breakpoint split view',
  async () =>
    mockConsoleWarn(async () => {
      const { findByTestId, queryAllByTestId } = await createView(
        breakpointConfig,
      )

      // the breakpoint could be partially loaded so explicitly wait for two items
      await waitFor(() => expect(queryAllByTestId('r1').length).toBe(2), delay)

      expect(
        await findByTestId('pacbio_hg002_breakpoints-loaded'),
      ).toMatchSnapshot()

      expect(await findByTestId('pacbio_vcf-loaded')).toMatchSnapshot()
    }),
  10000,
)
