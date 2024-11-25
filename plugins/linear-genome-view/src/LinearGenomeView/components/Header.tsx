import React from 'react'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getBpDisplayStr } from '@jbrowse/core/util'

// icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Button, IconButton, FormGroup, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import OverviewScalebar from './OverviewScalebar'
import SearchBox from './SearchBox'
import ZoomControls from './ZoomControls'
import { SPACING } from '../consts'
import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel
const useStyles = makeStyles()(theme => ({
  headerBar: {
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
    color: theme.palette.text.primary,
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
    marginLeft: theme.spacing(4),
  },
  buttonSpacer: {
    marginRight: theme.spacing(2),
  },
}))

const HeaderButtons = observer(({ model }: { model: LGV }) => {
  const { classes } = useStyles()
  return (
    <IconButton
      onClick={model.activateTrackSelector}
      className={classes.toggleButton}
      title="Open track selector"
      value="track_select"
    >
      <TrackSelectorIcon className={classes.buttonSpacer} />
    </IconButton>
  )
})

function PanControls({ model }: { model: LGV }) {
  const { classes } = useStyles()
  return (
    <>
      <Button
        variant="outlined"
        className={classes.panButton}
        onClick={() => {
          model.slide(-0.9)
        }}
      >
        <ArrowBackIcon />
      </Button>
      <Button
        variant="outlined"
        className={classes.panButton}
        onClick={() => {
          model.slide(0.9)
        }}
      >
        <ArrowForwardIcon />
      </Button>
    </>
  )
}

const RegionWidth = observer(function ({ model }: { model: LGV }) {
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

const LinearGenomeViewHeader = observer(function ({ model }: { model: LGV }) {
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
