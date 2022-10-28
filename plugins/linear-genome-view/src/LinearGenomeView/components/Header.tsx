import React from 'react'
import { observer } from 'mobx-react'
import { Button, FormGroup, Typography, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getBpDisplayStr } from '@jbrowse/core/util'

// icons
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

// locals
import {
  LinearGenomeViewModel,
  WIDGET_HEIGHT,
  SPACING,
  HEADER_BAR_HEIGHT,
} from '..'
import OverviewScaleBar from './OverviewScaleBar'
import ZoomControls from './ZoomControls'
import SearchBox from './SearchBox'

type LGV = LinearGenomeViewModel
const useStyles = makeStyles()(theme => ({
  headerBar: {
    height: HEADER_BAR_HEIGHT,
    display: 'flex',
  },
  headerForm: {
    flexWrap: 'nowrap',
    marginRight: 7,
  },
  spacer: {
    flexGrow: 1,
  },

  panButton: {
    background: alpha(theme.palette.background.paper, 0.8),
    height: WIDGET_HEIGHT,
    margin: SPACING,
  },
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 5,
  },
  toggleButton: {
    height: 44,
    border: 'none',
    margin: theme.spacing(0.5),
  },
  buttonSpacer: {
    marginRight: theme.spacing(2),
  },
}))

const HeaderButtons = observer(({ model }: { model: LGV }) => {
  const { classes } = useStyles()
  return (
    <Button
      onClick={model.activateTrackSelector}
      className={classes.toggleButton}
      title="Open track selector"
      value="track_select"
      color="secondary"
    >
      <TrackSelectorIcon className={classes.buttonSpacer} />
    </Button>
  )
})

function PanControls({ model }: { model: LGV }) {
  const { classes } = useStyles()
  return (
    <>
      <Button
        variant="outlined"
        className={classes.panButton}
        onClick={() => model.slide(-0.9)}
      >
        <ArrowBackIcon />
      </Button>
      <Button
        variant="outlined"
        className={classes.panButton}
        onClick={() => model.slide(0.9)}
      >
        <ArrowForwardIcon />
      </Button>
    </>
  )
}

const RegionWidth = observer(({ model }: { model: LGV }) => {
  const { classes } = useStyles()
  const { coarseTotalBp } = model
  return (
    <Typography variant="body2" color="textSecondary" className={classes.bp}>
      {getBpDisplayStr(coarseTotalBp)}
    </Typography>
  )
})

const Controls = ({ model }: { model: LGV }) => {
  const { classes } = useStyles()
  return (
    <div className={classes.headerBar}>
      <HeaderButtons model={model} />
      <div className={classes.spacer} />
      <FormGroup row className={classes.headerForm}>
        <PanControls model={model} />
        <SearchBox model={model} />
      </FormGroup>
      <RegionWidth model={model} />
      <ZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )
}

const LinearGenomeViewHeader = observer(({ model }: { model: LGV }) => {
  return !model.hideHeader ? (
    model.hideHeaderOverview ? (
      <Controls model={model} />
    ) : (
      <OverviewScaleBar model={model}>
        <Controls model={model} />
      </OverviewScaleBar>
    )
  ) : null
})

export default LinearGenomeViewHeader
