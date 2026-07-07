import {
  isSlotValueSessionDefault,
  setSlotValueSessionDefault,
} from '@jbrowse/core/configuration'

import type { PromotableDisplay } from '@jbrowse/core/configuration'

// The state + action for a single "make this the default for all tracks"
// control, bundled so a menu row can consume it as one prop instead of a
// separate is-default getter and toggle action.
export interface SessionDefaultControl {
  /** the setting's on-value is currently the session-wide default */
  active: boolean
  /** promote the on-value as the default, or clear it if already active */
  toggle: () => void
}

// Build the control for "slot === onValue is the session default". The meaning
// is per-value ("make arcs the default"), independent of the track's current
// value — so an always-visible control never promotes a meaningless off-value,
// and two toggles sharing one slot (arcs vs read cloud) stay independent.
export function makeSessionDefaultControl(
  self: PromotableDisplay,
  slot: string,
  onValue: unknown,
): SessionDefaultControl {
  const active = isSlotValueSessionDefault(self, slot, onValue)
  return {
    active,
    toggle: () => {
      setSlotValueSessionDefault(self, slot, onValue, !active)
    },
  }
}
