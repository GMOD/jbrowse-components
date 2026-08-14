import { fireEvent, render } from '@testing-library/react'

import TrackLabelRefNameWarning from './TrackLabelRefNameWarning.tsx'

import type { RefNameMismatch } from '@jbrowse/core/assemblyManager/assembly'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

function subject(refNameMismatch?: RefNameMismatch) {
  return render(
    <TrackLabelRefNameWarning
      track={{ trackId: 't1', refNameMismatch } as unknown as BaseTrackModel}
    />,
  )
}

const mismatch: RefNameMismatch = {
  assemblyName: 'hg38',
  adapter: { names: ['1', '2', '3'], total: 25 },
  assembly: { names: ['chr1', 'chr2', 'chr3'], total: 595 },
}

// The state this exists for is the one nobody can see: an empty track that is
// empty because the names disagree looks exactly like an empty track that has
// no features here.
test('renders nothing when the names agree', () => {
  expect(subject().queryByTestId('track-refname-warning-t1')).toBeNull()
})

test('the button opens a dialog naming the assembly, both schemes and the fix', () => {
  const { getByTestId, getByText } = subject(mismatch)
  fireEvent.click(getByTestId('track-refname-warning-t1'))
  // one node holds the whole message, so match on a substring of it
  const text = getByText(/hg38/).textContent
  expect(text).toContain('1, 2, 3 (and 22 more)')
  expect(text).toContain('chr1, chr2, chr3 (and 592 more)')
  expect(text).toContain('refNameAliases')
})
