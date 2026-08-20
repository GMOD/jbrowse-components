import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import type { LinearSyntenyViewModel } from './model.ts'

/**
 * The hysteresis rule: a fade that is off engages on the narrow threshold, and
 * one that is on lets go only when the wide one has gone false too.
 *
 * It exists because the signal underneath is not stable under scrolling.
 * `meanAlignmentPx` is a mean over the features the current fetch window holds,
 * the window is snapped to a grid roughly half a viewport wide, and every
 * rollover swaps a slice of that population — so the mean steps on a pan even
 * though nothing about the picture has changed. Against one threshold, a view
 * whose mean sits near it flipped the fade every few hundred pixels of
 * scrolling, and a flip moves EVERY sub-pixel ribbon in the stack between full
 * alpha and WIDTH_FADE_FLOOR at once.
 */
export function nextThinFadeLatch({
  previous,
  engages,
  holds,
}: {
  previous: boolean | undefined
  engages: boolean
  holds: boolean
}) {
  return previous ? holds : engages
}

/**
 * Keep `fadeThinAlignments`' latched 'auto' answer up to date.
 *
 * The previous value is read UNTRACKED, which is what keeps this from waking
 * itself: the latch is what the autorun writes, so tracking it would make every
 * move schedule another pass.
 */
export function installAutoFadeLatch(self: LinearSyntenyViewModel) {
  addDisposer(
    self,
    autorun(
      () => {
        const engages = self.autoFadeEngages
        const holds = self.autoFadeHolds
        const previous = untracked(() => self.fadeThinLatch)
        const next = nextThinFadeLatch({ previous, engages, holds })
        if (next !== previous) {
          self.setFadeThinLatch(next)
        }
      },
      { name: 'LinearSyntenyAutoFadeLatch' },
    ),
  )
}
