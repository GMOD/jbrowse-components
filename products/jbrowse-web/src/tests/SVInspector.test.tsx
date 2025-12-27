import '@testing-library/jest-dom'
import { fireEvent, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  mockConsoleWarn,
  openViewWithFileInput,
  setup,
} from './util'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 40000 }

test('opens a vcf.gz file in the sv inspector view', () => {
  return mockConsoleWarn(async () => {
    const { session, findByTestId } = await openViewWithFileInput({
      menuPath: ['File', 'Add', 'SV inspector'],
      fileUrl: 'volvox.dup.renamed.vcf.gz',
    })

    fireEvent.click(await findByTestId('chord-vcf-0', {}, delay))

    await waitFor(() => {
      expect(session.views.length).toBe(3)
    })
    expect(session.views[2]!.displayName).toBe('bnd_A split detail')
  })
}, 60000)

test('opens a track with minimal adapter config via "Open from track"', async () => {
  const { session, findByText, findByTestId, findByLabelText } =
    await createView()

  fireEvent.click(await findByText('File'))
  fireEvent.click(await findByText('Add'))
  fireEvent.click(await findByText('SV inspector'))

  fireEvent.click(await findByLabelText('Open from track', {}, delay))

  const trackDropdown = await findByLabelText('Tracks', {}, delay)
  fireEvent.mouseDown(trackDropdown)

  fireEvent.click(
    await findByText(
      '[Variants] volvox structural variant test w/renamed refs',
      {},
      delay,
    ),
  )

  const openButton = await findByTestId('open_spreadsheet', {}, delay)
  await waitFor(() => {
    expect(openButton.closest('button')).not.toBeDisabled()
  }, delay)

  fireEvent.click(openButton)

  fireEvent.click(await findByTestId('chord-vcf-6', {}, delay))

  await waitFor(() => {
    expect(session.views.length).toBe(3)
  }, delay)

  const breakpointView = session.views[2] as { views: { showTrack: (t: string) => void }[] }
  breakpointView.views[0]!.showTrack('volvox_sv_test_renamed')
  breakpointView.views[1]!.showTrack('volvox_sv_test_renamed')

  const container = await findByTestId(
    'volvox_sv_test_renamed-loaded',
    {},
    delay,
  )
  expect(container.querySelectorAll('path').length).toBe(3)
}, 60000)
