import { destroy, types } from '@jbrowse/mobx-state-tree'
import { render } from '@testing-library/react'

import DerivativeVsRefDialog from './LinearDerivativeVsRef.tsx'

import type { AbstractTrackModel } from '@jbrowse/core/util'

// "Replace current view" destroys the view the launching track lives in, so
// this dialog can outlive its own `track` by a task. Its props then resolve the
// source with `getSession` / `getContainingView`, and those WALK — a dead node
// throws where a scalar read would only warn, out of `DialogQueue`, which sits
// above every per-view boundary. `drawSplitView` closes before it can happen;
// this is the backstop under that ordering, so what it asserts is that a dead
// track produces no render rather than a throw.
test('the dialog renders nothing once its track is gone', () => {
  const track = types
    .model('DeadTrack', { id: types.identifier })
    .create({ id: 'track1' })
  destroy(track)

  const { container } = render(
    <DerivativeVsRefDialog
      model={{
        derivativePathCandidates: [],
        hasReadsForDerivativePaths: true,
      }}
      track={track as unknown as AbstractTrackModel}
      handleClose={() => {}}
    />,
  )

  expect(container.innerHTML).toBe('')
})
