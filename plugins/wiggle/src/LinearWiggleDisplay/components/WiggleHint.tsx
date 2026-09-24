import BlockMsg from '@jbrowse/display-kit/BlockMsg'
import { TrackOverlayPortal } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

// What the hint reads, spelled out like its sibling overlays (see
// WiggleRowSeparators, WiggleRowLabels) rather than taking the whole display.
export interface HintModel {
  numSources: number
  isOverlay: boolean
  isDensityMode: boolean
  effectiveRowHeight: number
  height: number
}

// Rows packed so tight they are sub-pixel draw as an unreadable smear rather
// than a blank, so the escape is named inline. Not in density, where the
// escape the message names IS the mode the user is in, and sub-pixel rows are
// the intended cohort view: a thousand-sample heatmap is read as a stack.
function hint({
  numSources,
  isOverlay,
  isDensityMode,
  effectiveRowHeight,
  height,
}: HintModel) {
  return !isOverlay &&
    !isDensityMode &&
    numSources > 0 &&
    effectiveRowHeight < 1
    ? `${numSources} subtracks in ${Math.round(height)}px leaves rows below 1px. Switch to an overlay or density rendering, or increase the track height.`
    : undefined
}

const WiggleHint = observer(function WiggleHint({
  model,
}: {
  model: HintModel
}) {
  const message = hint(model)
  return message ? (
    <TrackOverlayPortal>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
        }}
      >
        <BlockMsg severity="warning" message={message} />
      </div>
    </TrackOverlayPortal>
  ) : null
})

export default WiggleHint
