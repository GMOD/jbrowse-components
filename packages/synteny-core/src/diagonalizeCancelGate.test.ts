import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { DiagonalizeProgressMixin } from './DiagonalizeProgressMixin.ts'
import { withDiagonalizeProgress } from './withDiagonalizeProgress.ts'

// Cancelling a reorder is the user saying "stop, this view is the one I want" —
// so the `settled` gate has to come down. It is the abort path, not the error
// path: the reorder throws, `withDiagonalizeProgress` swallows it, and the
// caller's `finishAutoDiagonalize()` is skipped by design (a genuine failure
// must keep the gate raised so a capture times out loudly rather than
// committing a hairball). Left raised on a cancel too, `settled` is false
// forever and the capture tools hang on a view the user is done with.
function viewWithGate() {
  return DiagonalizeProgressMixin().create({})
}

test('a cancelled reorder lowers the gate', async () => {
  const self = viewWithGate()
  self.beginAutoDiagonalize(true)

  const run = withDiagonalizeProgress(self, async ({ stopToken }) => {
    self.cancelAutoDiagonalize()
    checkStopToken(stopToken)
    self.finishAutoDiagonalize()
  })
  await run

  expect(self.awaitingAutoDiagonalize).toBe(false)
  expect(self.pendingAutoDiagonalize).toBe(false)
})

test('a reorder that fails on its own keeps the gate raised', async () => {
  const self = viewWithGate()
  self.beginAutoDiagonalize(true)

  await withDiagonalizeProgress(self, async () => {
    throw new Error('the RPC died')
  })

  expect(self.awaitingAutoDiagonalize).toBe(false)
  expect(self.pendingAutoDiagonalize).toBe(true)
})
