import { act, render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { observer } from 'mobx-react'

import { createViewStateAsync } from '../index.ts'
import JBrowseLinearGenomeView from './JBrowseLinearGenomeView.tsx'

jest.mock('../makeWorkerInstance', () => () => {})

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        {
          refName: 'ctgA',
          uniqueId: 'firstId',
          start: 0,
          end: 120,
          seq: 'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagccttggtttagattggtagtagtagcggcgctaatgctacctg',
        },
      ],
    },
  },
}

const ThrowingDialog = observer(function ThrowingDialog(): React.ReactNode {
  throw new Error('the dialog could not render')
})

test('a dialog that throws while rendering shows a closeable error and leaves the view up', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
  const user = userEvent.setup()
  const state = await createViewStateAsync({
    assembly,
    tracks: [],
    location: 'ctgA:1-100',
  })
  render(<JBrowseLinearGenomeView viewState={state} />)
  await screen.findByPlaceholderText('Search for location')

  act(() => {
    state.session.queueDialog(() => [ThrowingDialog, {}])
  })

  await screen.findByText('the dialog could not render', { exact: false })
  expect(screen.getByPlaceholderText('Search for location')).toBeTruthy()

  await user.click(screen.getByTestId('dialog-close'))

  await waitFor(() => {
    expect(
      screen.queryByText('the dialog could not render', { exact: false }),
    ).toBeNull()
  })
  expect(state.session.DialogComponent).toBeUndefined()
  expect(screen.getByPlaceholderText('Search for location')).toBeTruthy()
  consoleError.mockRestore()
})
