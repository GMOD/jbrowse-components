import { makeStyles } from '@jbrowse/core/util/tss-react'
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  scrollZoomButton: {
    height: 44,
    border: 'none',
    textTransform: 'none',
  },
})

const ScrollZoomToggle = observer(function ScrollZoomToggle({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  return (
    <Tooltip title="Scroll wheel zooms instead of scrolls">
      <ToggleButton
        value="scrollZoom"
        selected={model.scrollZoom}
        onChange={() => {
          model.setScrollZoom(!model.scrollZoom)
        }}
        className={classes.scrollZoomButton}
        size="small"
      >
        <ZoomInMapIcon />
      </ToggleButton>
    </Tooltip>
  )
})

export default ScrollZoomToggle
