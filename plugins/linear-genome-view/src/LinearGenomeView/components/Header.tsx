import { makeStyles } from '@jbrowse/core/util/tss-react'
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { ToggleButton } from '@mui/material'
import { observer } from 'mobx-react'

import HeaderClearHighlightButton from './HeaderClearHighlightButton.tsx'
import HeaderPanControls from './HeaderPanControls.tsx'
import HeaderRegionWidth from './HeaderRegionWidth.tsx'
import HeaderTrackSelectorButton from './HeaderTrackSelectorButton.tsx'
import HeaderZoomControls from './HeaderZoomControls.tsx'
import OverviewScalebar from './OverviewScalebar.tsx'
import SearchBox from './SearchBox.tsx'
import { HEADER_BAR_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()({
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: HEADER_BAR_HEIGHT,
  },
  spacer: {
    flexGrow: 1,
  },
  scrollZoomButton: {
    border: 'none',
    textTransform: 'none',
  },
})

const Controls = observer(function Controls({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.headerBar}>
      <HeaderTrackSelectorButton model={model} />
      <ToggleButton
        value="scrollZoom"
        selected={model.scrollZoom}
        title="Toggle scroll zoom on WebGL tracks"
        className={classes.scrollZoomButton}
        size="small"
        onChange={() => {
          model.setScrollZoom(!model.scrollZoom)
        }}
      >
        <ZoomInMapIcon />
      </ToggleButton>
      <div className={classes.spacer} />
      <HeaderPanControls model={model} />
      <SearchBox model={model} />
      <HeaderClearHighlightButton model={model} />
      <HeaderRegionWidth model={model} />
      <HeaderZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )
})

const LinearGenomeViewHeader = observer(function LinearGenomeViewHeader({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { hideHeader, hideHeaderOverview } = model
  return !hideHeader ? (
    hideHeaderOverview ? (
      <Controls model={model} />
    ) : (
      <OverviewScalebar model={model}>
        <Controls model={model} />
      </OverviewScalebar>
    )
  ) : null
})

export default LinearGenomeViewHeader
