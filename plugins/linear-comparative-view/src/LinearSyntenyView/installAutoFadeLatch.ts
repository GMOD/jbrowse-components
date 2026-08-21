import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { fadesThinAt } from './fadeThin.ts'

import type { LinearSyntenyViewModel } from './model.ts'

/**
 * Keep `fadeThinAlignments`' latched 'auto' answer up to date.
 *
 * The latch is what this writes, so it reads the previous value UNTRACKED —
 * tracking it would make every move schedule another pass. `fadesThinAt` is the
 * same function the getter resolves through, so the value stored here is the
 * value already being read.
 */
export function installAutoFadeLatch(self: LinearSyntenyViewModel) {
  addDisposer(
    self,
    autorun(
      () => {
        const widthPx = self.autoFadeWidthPx
        const previous = untracked(() => self.fadeThinLatch)
        const next = fadesThinAt(widthPx, previous)
        if (next !== previous) {
          self.setFadeThinLatch(next)
        }
      },
      { name: 'LinearSyntenyAutoFadeLatch' },
    ),
  )
}
