import { TrackOverlayPortal } from '@jbrowse/display-ui'

import type { ReactNode } from 'react'

/**
 * The two phases that replace the whole chrome with a banner still say which
 * display is showing it, so a capture can tell a banner from a display that
 * never mounted. No `data-testid`: that names a display whose body is on
 * screen, and `display: contents` keeps the banner's own box the layout.
 *
 * The banner goes to the track's overlay layer, like the status overlays in
 * `DisplayStatusChromeBase`, so the LGV's region separators don't stripe it.
 * That layer takes no pointer events, so the wrapper takes them back for the
 * banner's buttons.
 */
export default function ReplacedDisplay({
  model,
  phase,
  children,
}: {
  model: { configuration: { displayId: string } }
  phase: 'tooLarge' | 'renderError'
  children: ReactNode
}) {
  return (
    <div
      style={{ display: 'contents' }}
      data-display-id={model.configuration.displayId}
      data-display-phase={phase}
    >
      <TrackOverlayPortal>
        <div style={{ pointerEvents: 'auto' }}>{children}</div>
      </TrackOverlayPortal>
    </div>
  )
}
