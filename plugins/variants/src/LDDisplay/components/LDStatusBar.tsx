import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { colord } from '@jbrowse/core/util/colord'
import { observer } from 'mobx-react'

import type { SharedLDModel } from '../shared.ts'

// Structural, so the text is assertable without building a display — the same
// arrangement `buildLDTrackMenuItems` uses for the track menu's shape.
export interface LDStatusSelf {
  loadedLDWindow: number | undefined
}

/**
 * How far apart two variants may be for their pair to be drawn at all.
 *
 * Nothing in the plot says a window is in force: a pair past it is not drawn,
 * and against a light theme an in-band pair at r² = 0 — the ramp's white end,
 * at full alpha — is the same pixel as the background those undrawn cells
 * leave. So long-range LD, the case worth looking for, reads as absent rather
 * than as unmeasured unless the window is named somewhere.
 */
export function ldStatusParts({ loadedLDWindow }: LDStatusSelf) {
  return loadedLDWindow === undefined
    ? []
    : [`pairs up to ${loadedLDWindow} variants apart`]
}

const LDStatusBar = observer(function LDStatusBar({
  model,
}: {
  model: SharedLDModel
}) {
  // Themed, not hardcoded: this badge sits over the triangle, so a fixed white
  // pill with grey text is a bright block in a dark session.
  const palette = usePalette()
  const parts = ldStatusParts(model)
  if (parts.length === 0) {
    return null
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 2,
        left: 4,
        fontSize: 10,
        color: palette.text.secondary,
        background: colord(palette.background.default)
          .alpha(0.75)
          .toRgbString(),
        padding: '1px 4px',
        borderRadius: 3,
        pointerEvents: 'none',
      }}
    >
      {parts.join(' · ')}
    </div>
  )
})

export default LDStatusBar
