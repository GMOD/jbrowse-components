import { makeStyles } from '@jbrowse/core/util/tss-react'
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { FormGroup, ToggleButton } from '@mui/material'
import { observer } from 'mobx-react'

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
    height: HEADER_BAR_HEIGHT,
  },
  headerForm: {
    flexWrap: 'nowrap',
    marginRight: 7,
  },
  spacer: {
    flexGrow: 1,
  },
  scrollZoomButton: {
    height: 44,
    border: 'none',
    textTransform: 'none',
  },
})

const ScrollZoomButton = observer(function ScrollZoomButton({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <ToggleButton
      value="scrollZoom"
      selected={model.scrollZoom}
      onChange={() => {
        model.setScrollZoom(!model.scrollZoom)
      }}
      title="Toggle scroll zoom on WebGL tracks"
      className={classes.scrollZoomButton}
      size="small"
    >
      <ZoomInMapIcon />
    </ToggleButton>
  )
})

const Controls = function ({ model }: { model: LinearGenomeViewModel }) {
  const { classes } = useStyles()
  return (
    <div className={classes.headerBar}>
      <HeaderTrackSelectorButton model={model} />
      <ScrollZoomButton model={model} />
      <div className={classes.spacer} />
      <FormGroup row className={classes.headerForm}>
        <HeaderPanControls model={model} />
        <SearchBox model={model} />
      </FormGroup>
      <HeaderRegionWidth model={model} />
      <HeaderZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )
}

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
