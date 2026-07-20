import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../index.ts'

// epsilon guards against the button flickering to disabled from float rounding
// exactly at the zoom limit
const EPSILON = 0.0001

const ZoomButton = observer(function ZoomButton({
  model,
  direction,
  small,
}: {
  model: LinearGenomeViewModel
  direction: 'in' | 'out'
  small?: boolean
}) {
  // disabled tracks the debounced coarseBpPerPx (not live bpPerPx) so it doesn't
  // flicker disabled during a zoom animation
  const { maxBpPerPx, minBpPerPx, coarseBpPerPx } = model
  const out = direction === 'out'
  const disabled = out
    ? coarseBpPerPx >= maxBpPerPx - EPSILON
    : coarseBpPerPx <= minBpPerPx + EPSILON
  const fontSize = small ? 'small' : undefined
  return (
    <Tooltip title={out ? 'Zoom out 2x' : 'Zoom in 2x'}>
      <span>
        <IconButton
          data-testid={out ? 'zoom_out' : 'zoom_in'}
          size={small ? 'small' : undefined}
          disabled={disabled}
          onClick={() => {
            model.zoom(out ? model.bpPerPx * 2 : model.bpPerPx / 2)
          }}
        >
          {out ? (
            <ZoomOut fontSize={fontSize} />
          ) : (
            <ZoomIn fontSize={fontSize} />
          )}
        </IconButton>
      </span>
    </Tooltip>
  )
})

export default ZoomButton
