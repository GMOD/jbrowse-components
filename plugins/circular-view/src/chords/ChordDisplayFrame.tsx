import { observer } from 'mobx-react'

import DisplayError from './DisplayError.tsx'
import Loading from './Loading.tsx'

import type { ChordDisplayFrameModel } from './types.ts'
import type { ReactNode } from 'react'

const ChordDisplayFrame = observer(function ChordDisplayFrame({
  display,
  children,
}: {
  display: ChordDisplayFrameModel
  children: ReactNode
}) {
  const phase = display.displayPhase
  const cell = display.chordCell
  const { chordPass } = display.view
  const drawn =
    phase === 'error' ||
    (phase === 'ready' &&
      (!cell || chordPass.drew(cell) || chordPass.renderError !== undefined))
  return (
    <g
      // The fourth attribute the chrome publishes, not three: `displayPainted`
      // and `displaySettled` are conjunctions of a testid AND a display
      // attribute on ONE element, and the pending-display census names an entry
      // by it. `structuralVariantChordRenderer` cannot serve — it is on the
      // inner group, which the loading branch does not render.
      data-testid="circular-chord-display"
      data-display-id={display.configuration.displayId}
      // Drawn once the view's chord canvas has painted this display's current
      // cell, or can paint nothing more: an error ring, or a backend that
      // failed to start, is finished rather than pending, as
      // `foundationPaintInert` reads them for the canvas families.
      data-display-drawn={drawn}
      data-display-phase={phase}
    >
      {phase === 'error' ? (
        <DisplayError
          model={display}
          onClick={() => {
            display.openErrorDialog()
          }}
          onRetry={() => {
            display.reload()
          }}
        />
      ) : phase === 'loading' ? (
        <Loading model={display} />
      ) : (
        children
      )}
    </g>
  )
})

export default ChordDisplayFrame
