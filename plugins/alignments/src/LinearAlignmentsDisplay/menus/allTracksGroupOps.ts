import { PAIR_OVERLAY_OPTIONS } from './readConnections.ts'

import type { ReadConnectionsMode } from '../constants.ts'
import type { GroupOp } from '@jbrowse/core/ui'

interface ReadConnectionsSettable {
  setReadConnections: (mode: ReadConnectionsMode) => void
}

function isReadConnectionsSettable(d: unknown): d is ReadConnectionsSettable {
  return d !== null && typeof d === 'object' && 'setReadConnections' in d
}

// "All tracks" group op: set the read-connection arc mode across every
// alignments display at once. An idempotent set (not a per-track toggle) so all
// tracks land in the same mode regardless of their prior state; checked state
// is intentionally omitted since tracks may start out mixed.
export const readConnectionsGroupOp: GroupOp = displays => {
  const settable = displays.filter(isReadConnectionsSettable)
  function apply(mode: ReadConnectionsMode) {
    for (const display of settable) {
      display.setReadConnections(mode)
    }
  }
  return settable.length === 0
    ? []
    : [
        {
          label: 'Read connections',
          subMenu: PAIR_OVERLAY_OPTIONS.map(({ value, label }) => ({
            label,
            onClick: () => {
              apply(value)
            },
          })),
        },
      ]
}
