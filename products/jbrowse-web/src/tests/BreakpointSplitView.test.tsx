import '@testing-library/jest-dom'

import { fireEvent, waitFor } from '@testing-library/react'

import breakpointConfig from '../../test_data/breakpoint/config.json' with { type: 'json' }
import { createView, doBeforeEach, mockConsoleWarn, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach(url => require.resolve(`../../test_data/breakpoint/${url}`))
})

const delay = { timeout: 40000 }

test('breakpoint split view', () => {
  return mockConsoleWarn(async () => {
    const { getByTestId, queryAllByTestId } = await createView(breakpointConfig)

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
  })
}, 40000)

test('the Add menu opens an empty breakpoint split view', async () => {
  const { session, findByText } = await createView(breakpointConfig)

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('Breakpoint split view'))
  await waitFor(() => {
    expect(session.views.at(-1)?.type).toBe('BreakpointSplitView')
  }, delay)
})
