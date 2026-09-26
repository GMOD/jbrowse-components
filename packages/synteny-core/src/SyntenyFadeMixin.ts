import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { fadesThinAt } from './fadeThin.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

export type FadeThinMode = 'auto' | 'on' | 'off'

/**
 * #stateModel SyntenyFadeMixin
 *
 * The two fades a view drawing synteny ribbons offers, whatever the colour
 * mode: an alignment by its sequence identity, and a sub-pixel alignment by
 * its on-screen width, so a dense whole-genome picture keeps its density
 * instead of saturating. The linear synteny view and the circular view both
 * compose it; a view supplies `autoFadeWidthPx`.
 */
export function SyntenyFadeMixin() {
  return types
    .model('SyntenyFadeMixin', {
      /**
       * #property
       * Fade alignment blocks by per-feature identity (lower identity = more
       * transparent), whatever the color mode.
       */
      opacityByIdentity: types.stripDefault(types.boolean, false),
      /**
       * #property
       * Fade a sub-pixel-thin ribbon's opacity by its on-screen width, so an
       * unfiltered whole-genome view doesn't read as a full-opacity hairball.
       * 'auto' fades once a display is dominated by sub-pixel ribbons and
       * leaves a sparse comparison at full alpha; 'on'/'off' pin it. Resolved
       * view-wide by `fadeThinAlignments`.
       */
      fadeThinAlignmentsMode: types.stripDefault(
        types.enumeration('FadeThinMode', ['auto', 'on', 'off']),
        'auto',
      ),
    })
    .volatile(() => ({
      /**
       * #volatile
       * Whether the 'auto' thin-fade is latched on (see `fadeThinAlignments`).
       */
      fadeThinLatch: false,
    }))
    .views(() => ({
      /**
       * #getter
       * Overridable hook: the width 'auto' compares against its thresholds,
       * the narrowest capped mean block width of any display with enough
       * blocks to judge, or `Infinity` with none.
       */
      get autoFadeWidthPx(): number {
        return Infinity
      },
    }))
    .views(self => ({
      /**
       * #getter
       * The resolved fade-thin flag every display renders by. 'auto' fades once
       * any loaded display is dominated by sub-pixel ribbons, latched with a
       * deadband (`fadesThinAt`, ADR-083) so a view near the threshold does not
       * flip while panning. View-wide, so every display fades together.
       */
      get fadeThinAlignments(): boolean {
        const { fadeThinAlignmentsMode, fadeThinLatch } = self
        return fadeThinAlignmentsMode === 'auto'
          ? fadesThinAt(self.autoFadeWidthPx, fadeThinLatch)
          : fadeThinAlignmentsMode === 'on'
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setOpacityByIdentity(arg: boolean) {
        self.opacityByIdentity = arg
      },
      /**
       * #action
       */
      setFadeThinAlignmentsMode(arg: FadeThinMode) {
        self.fadeThinAlignmentsMode = arg
      },
      /**
       * #action
       * Move the latched 'auto' thin-fade decision — `installAutoFadeLatch` is
       * the only caller.
       */
      setFadeThinLatch(arg: boolean) {
        self.fadeThinLatch = arg
      },
    }))
}

export interface SyntenyFadeModel extends Instance<
  ReturnType<typeof SyntenyFadeMixin>
> {}

/**
 * Keep `fadeThinAlignments`' latched 'auto' answer up to date.
 *
 * The latch is what this writes, so it reads the previous value UNTRACKED —
 * tracking it would make every move schedule another pass. `fadesThinAt` is the
 * same function the getter resolves through, so the value stored here is the
 * value already being read.
 */
export function installAutoFadeLatch(self: SyntenyFadeModel) {
  addDisposer(
    self,
    autorun(
      () => {
        if (self.fadeThinAlignmentsMode !== 'auto') {
          return
        }
        const widthPx = self.autoFadeWidthPx
        // eslint-disable-next-line no-restricted-syntax -- self-write: the latch is what this writes
        const previous = untracked(() => self.fadeThinLatch)
        const next = fadesThinAt(widthPx, previous)
        if (next !== previous) {
          self.setFadeThinLatch(next)
        }
      },
      { name: 'SyntenyAutoFadeLatch' },
    ),
  )
}
