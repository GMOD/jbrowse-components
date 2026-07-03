import {
  clearDisplaySessionDefaults,
  displaySessionDefaultChanges,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { PromotableDisplay } from '@jbrowse/core/configuration'
import type { TrackConfigChange } from '@jbrowse/core/util'

/**
 * #stateModel PromotableDefaultsMixin
 * #category display
 *
 * The `AbstractDisplayModel` side of `promotable` config slots (see
 * `@jbrowse/core/configuration` `promotableDefaults.ts`): exposes the
 * session-default badge hooks the track selector calls polymorphically on any
 * display. A display whose config schema has any `promotable` slot composes
 * this so the "affected by a session default" badge and its "clear default"
 * action work without re-implementing the two delegations per display type.
 */
export default function PromotableDefaultsMixin() {
  return types
    .model({})
    .views(self => ({
      /**
       * #method
       * Effective config differences an un-pinned track inherits from
       * session-wide defaults (distinct from per-track config edits /
       * trackConfigDeltas). Drives the "affected by a session default" badge.
       */
      sessionDefaultChanges(): TrackConfigChange[] {
        return displaySessionDefaultChanges(
          self as unknown as PromotableDisplay,
        )
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Clear the session-wide defaults reported by `sessionDefaultChanges` so
       * this display (and its siblings of the same type) revert to their config
       * values. Backs the "clear default" action on the selector badge.
       */
      clearSessionDefaults() {
        clearDisplaySessionDefaults(self as unknown as PromotableDisplay)
      },
    }))
}
