import {
  TrackControlProvider,
  plainTrackControl,
} from '@jbrowse/plugin-linear-genome-view'
import { fireEvent, render, screen } from '@testing-library/react'

import PileupTruncatedIndicator from './PileupTruncatedIndicator.tsx'

// This corner notice used to be a themed div plus a Material `Link`, drawn past
// the `TrackControl` seam entirely — so a host that installed
// `plainTrackControl` got plain controls everywhere until a pileup happened to
// truncate, and then a Material widget appeared. Pinned here rather than left to
// the build-your-own smoke census, which cannot see it: the volvox pileup that
// site renders never truncates.
test('goes through the TrackControl seam', () => {
  const onShowAll = jest.fn()
  const { baseElement } = render(
    <TrackControlProvider value={plainTrackControl}>
      <PileupTruncatedIndicator onShowAll={onShowAll} />
    </TrackControlProvider>,
  )
  expect(baseElement.querySelectorAll('[class*="Mui"]')).toHaveLength(0)
  fireEvent.click(screen.getByText('Max height reached'))
  expect(onShowAll).toHaveBeenCalledTimes(1)
})
