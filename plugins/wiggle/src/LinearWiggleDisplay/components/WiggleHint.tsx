import BlockMsg from '@jbrowse/display-kit/BlockMsg'
import { TrackOverlayPortal } from '@jbrowse/display-ui'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { WiggleMarkObject } from '../../renderingTypes.ts'

// What the hint reads, spelled out like its sibling overlays (see
// WiggleRowSeparators, WiggleRowLabels) rather than taking the whole display.
export interface HintModel {
  numRows: number
  isOverlay: boolean
  isDensityMode: boolean
  isGroupedRows: boolean
  effectiveRowHeight: number
  height: number
  setPlot: (plot: { mark: WiggleMarkObject; rowsField: string }) => void
}

// Rows packed so tight they are sub-pixel draw as an unreadable smear rather
// than a blank, so the escape is offered inline. Not in density, where the
// escape the button offers IS the mode the user is in, and sub-pixel rows are
// the intended cohort view: a thousand-sample heatmap is read as a stack.
// Grouped rows get no button: a heatmap overlays a row's sources, the last
// covering the rest, and a row per source is more rows still.
function hint({
  numRows,
  isOverlay,
  isDensityMode,
  effectiveRowHeight,
  height,
}: HintModel) {
  return !isOverlay && !isDensityMode && numRows > 0 && effectiveRowHeight < 1
    ? `${numRows} rows in ${Math.round(height)}px leaves each below 1px.`
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
        <BlockMsg
          severity="warning"
          message={message}
          action={
            model.isGroupedRows ? undefined : (
              <Button
                size="small"
                onClick={() => {
                  model.setPlot({ mark: { type: 'rect' }, rowsField: 'source' })
                }}
              >
                Draw as heatmap
              </Button>
            )
          }
        />
      </div>
    </TrackOverlayPortal>
  ) : null
})

export default WiggleHint
