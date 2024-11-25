import '@testing-library/jest-dom'
import { waitFor } from '@testing-library/react'

import { createView, doBeforeEach, mockConsoleWarn, setup } from './util'
import breakpointConfig from '../../test_data/breakpoint/config.json'

setup()

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../test_data/breakpoint/${url}`))
})

const delay = { timeout: 40000 }

test(
  'breakpoint split view',
  () =>
    mockConsoleWarn(async () => {
      const { getByTestId, queryAllByTestId } =
        await createView(breakpointConfig)

      // the breakpoint could be partially loaded so explicitly wait for two items
      await waitFor(() => {
        expect(queryAllByTestId('r1').length).toBe(2)
      }, delay)
      await waitFor(() => {
        expect(queryAllByTestId('r2').length).toBe(1)
      }, delay)

      await waitFor(() => {
        expect(getByTestId('pacbio_hg002_breakpoints-loaded')).toMatchSnapshot()
      }, delay)
      await waitFor(() => {
        expect(getByTestId('pacbio_vcf-loaded')).toMatchSnapshot()
      }, delay)
    }),
  40000,
)
