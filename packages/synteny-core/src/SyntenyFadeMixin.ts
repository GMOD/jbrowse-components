import { readConfObject } from '@jbrowse/core/configuration'
import { addDisposer, cast, getSnapshot, types } from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import { fadesThinAt } from './fadeThin.ts'
import { syntenyRenderConfigSchema } from './syntenyRenderConfigSchema.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel SyntenyFadeMixin
 *
 * The fade a view drawing synteny ribbons offers whatever the color mode: a
 * sub-pixel alignment by its on-screen width, so a dense whole-genome picture
 * keeps its density instead of saturating. A fade by the data is the
 * `opacity` object's (`SyntenyColorsMixin`). The linear synteny view and the
 * circular view both compose it; a view supplies `autoFadeWidthPx`.
 */
export function SyntenyFadeMixin() {
  return types
    .model('SyntenyFadeMixin', {
      /**
       * #property
       * How the ribbons rasterize, a [](/docs/config/syntenyrender) object:
       * `antialias` fades a sub-pixel ribbon by its on-screen width, so an
       * unfiltered whole-genome view doesn't read as a full-opacity hairball.
       * Unset, it fades once sub-pixel ribbons dominate a display and leaves
       * a sparse comparison at full alpha; `true` and `false` fix it. Resolved
       * view-wide by `fadeThinAlignments`.
       */
      render: types.stripDefault(syntenyRenderConfigSchema, {}),
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
       * `render.antialias`, undefined while it follows the data.
       */
      get antialias(): boolean | undefined {
        return readConfObject(self.render, 'antialias')
      },
      /**
       * #getter
       * The resolved fade-thin flag every display renders by. 'auto' fades once
       * sub-pixel ribbons dominate any loaded display, latched with a
       * deadband (`fadesThinAt`, ADR-083) so a view near the threshold does not
       * flip while panning. View-wide, so every display fades together.
       */
      get fadeThinAlignments(): boolean {
        const { antialias } = this
        return (
          antialias ?? fadesThinAt(self.autoFadeWidthPx, self.fadeThinLatch)
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setAntialias(antialias: boolean | undefined) {
        self.render = cast({ ...getSnapshot(self.render), antialias })
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
        if (self.antialias !== undefined) {
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
