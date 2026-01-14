import { fireEvent, waitFor } from '@testing-library/react'

import { createView, doBeforeEach, hts, setup } from './util.tsx'

setup()

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 10000 }
const opts = [{}, delay]

test('add temporary assembly and toggle reference sequence track', async () => {
  const { session, view, findByTestId, findAllByText } = await createView()

  // Wait for initial view to load
  await findAllByText('ctgA', ...opts)

  const testAssemblyName = 'testProtein'
  const refSeqTrackId = `${testAssemblyName}-ReferenceSequenceTrack`

  // Add a temporary assembly programmatically
  session.addTemporaryAssembly?.({
    name: testAssemblyName,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: refSeqTrackId,
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: testAssemblyName,
            uniqueId: 'test-seq-1',
            start: 0,
            end: 100,
            seq: 'MVLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSH',
          },
        ],
      },
    },
  })

  // Verify the assembly was added
  expect(session.temporaryAssemblies?.length).toBeGreaterThan(0)

  // Clear the current view and navigate to the new assembly
  view.clearView()

  // Try to navigate to the new assembly
  await view.navToLocString(testAssemblyName, testAssemblyName)

  // Now try to toggle the reference sequence track via UI
  // The track selector should show the reference sequence track for this assembly
  const trackEntry = await findByTestId(hts(refSeqTrackId), ...opts)
  fireEvent.click(trackEntry)

  // Wait for the track to be added
  await waitFor(
    () => {
      expect(view.tracks.length).toBe(1)
    },
    { timeout: 10000 },
  )

  // Verify the track was added successfully
  expect(view.tracks[0]?.configuration.trackId).toBe(refSeqTrackId)
}, 60000)
