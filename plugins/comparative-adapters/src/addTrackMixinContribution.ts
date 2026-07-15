import { useEffect } from 'react'

import { isAlive } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export type AddTrackComponentModel = IAnyStateTreeNode & {
  setMixinData: (data: Record<string, unknown>) => void
}

// A synteny add-track picker contributes adapter-specific fields (assembly
// pairs, BED locations) to the track config the widget builds on submit. It
// does this by writing an initial fragment on mount — so untouched defaults
// still reach the track — and retracting it on unmount — so switching to a
// non-synteny adapter isn't left with stale fields. Live edits are pushed
// straight from the input event handlers, never mirrored through an effect:
// https://react.dev/learn/you-might-not-need-an-effect
export function useSeedTrackMixin(
  model: AddTrackComponentModel,
  initial: Record<string, unknown>,
) {
  useEffect(
    () => {
      model.setMixinData(initial)
      return () => {
        // the widget may already be detached during submit teardown
        if (isAlive(model)) {
          model.setMixinData({})
        }
      }
    },
    // mount-seed + unmount-retract only; live edits come from event handlers
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [],
  )
}
