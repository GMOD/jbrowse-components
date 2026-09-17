import { useState } from 'react'

import { SingleSlider } from '@jbrowse/core/ui'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVert from '@mui/icons-material/MoreVert'
import { observer } from 'mobx-react'

import { zoomMenuItems } from '../menuItems.ts'
import ZoomButton from './ZoomButton.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    width: 100,
    color: theme.palette.text.secondary,
    // The value here is live `bpPerPx`, so MUI's default 150ms ease on the thumb
    // and the track restarts on every animation frame of a wheel zoom: the
    // transition never completes, the thumb trails the zoom it is reporting, and
    // the compositor gives up on the track's animated width every frame. A
    // slider that reports a value rather than being dragged to one wants no
    // transition at all.
    '& .MuiSlider-thumb, & .MuiSlider-track': {
      transition: 'none',
    },
  },
}))

// The slider tracks live `bpPerPx`, which changes on every animation frame of a
// zoom. Isolated into its own observer so the surrounding zoom buttons/menu —
// whose MUI Tooltip/IconButton machinery is comparatively expensive and only
// depends on the debounced `coarseBpPerPx` — don't re-render every frame.
const ZoomSlider = observer(function ZoomSlider({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { width, maxBpPerPx, minBpPerPx, bpPerPx } = model
  const [dragValue, setDragValue] = useState<number | null>(null)
  const value = dragValue ?? -Math.log2(bpPerPx) * 100
  return (
    <SingleSlider
      size="small"
      className={classes.slider}
      value={value}
      min={-Math.log2(maxBpPerPx) * 100}
      max={-Math.log2(minBpPerPx) * 100}
      onChangeCommitted={val => {
        setDragValue(null)
        model.cancelZoomAnimation()
        model.zoomTo(2 ** (-val / 100))
      }}
      valueLabelDisplay="auto"
      valueLabelFormat={newValue =>
        `Window size: ${getBpDisplayStr(2 ** (-newValue / 100) * width)}`
      }
      onChange={val => {
        // Take over from any in-flight animated zoom as soon as the user grabs
        // the thumb, so the view stops lurching underneath the drag.
        if (dragValue === null) {
          model.cancelZoomAnimation()
        }
        setDragValue(val)
      }}
    />
  )
})

const HeaderZoomControls = observer(function HeaderZoomControls({
  model,
  showSlider = true,
}: {
  model: LinearGenomeViewModel
  showSlider?: boolean
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.container}>
      <ZoomButton model={model} direction="out" />
      {/* the first control here a narrow header drops: the buttons either side
      halve and double, and the menu below reaches any factor the drag could */}
      {showSlider ? <ZoomSlider model={model} /> : null}
      <ZoomButton model={model} direction="in" />
      <CascadingMenuButton menuItems={() => zoomMenuItems(model)}>
        <MoreVert />
      </CascadingMenuButton>
    </div>
  )
})

export default HeaderZoomControls
