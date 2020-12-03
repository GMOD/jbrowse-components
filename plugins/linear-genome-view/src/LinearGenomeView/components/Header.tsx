import { Region } from '@jbrowse/core/util/types'
import { getSession, isSessionModelWithWidgets } from '@jbrowse/core/util' // eslint-disable-line no-unused-vars
import Button from '@material-ui/core/Button'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import FormGroup from '@material-ui/core/FormGroup'
import Typography from '@material-ui/core/Typography'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useCallback } from 'react'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import { LinearGenomeViewStateModel, HEADER_BAR_HEIGHT } from '..'
import RefNameAutocomplete from './RefNameAutocomplete'
import OverviewScaleBar from './OverviewScaleBar'
import ZoomControls from './ZoomControls'

type LGV = Instance<LinearGenomeViewStateModel>

const WIDGET_HEIGHT = 32
const SPACING = 7

const useStyles = makeStyles(theme => ({
  headerBar: {
    height: HEADER_BAR_HEIGHT,
    display: 'flex',
  },
  spacer: {
    flexGrow: 1,
  },
  input: {},
  headerRefName: {
    minWidth: 100,
  },
  panButton: {
    background: fade(theme.palette.background.paper, 0.8),
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
}))

const Controls = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const session = getSession(model)
  return (
    <ToggleButton
      onChange={model.activateTrackSelector}
      className={classes.toggleButton}
      title="Open track selector"
      value="track_select"
      color="secondary"
      selected={
        isSessionModelWithWidgets(session) &&
        session.visibleWidget &&
        session.visibleWidget.id === 'hierarchicalTrackSelector' &&
        // @ts-ignore
        session.visibleWidget.view.id === model.id
      }
    >
      <TrackSelectorIcon />
    </ToggleButton>
  )
})

function PanControls({ model }: { model: LGV }) {
  const classes = useStyles()
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

export default observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const theme = useTheme()
  const { coarseDynamicBlocks: contentBlocks, displayedRegions } = model

  const setDisplayedRegion = useCallback(
    (region: Region | undefined) => {
      if (region) {
        model.setDisplayedRegions([region])
        model.showAllRegions()
      }
    },
    [model],
  )

  const { assemblyName, refName } = contentBlocks[0] || { refName: '' }

  const controls = (
    <div className={classes.headerBar}>
      <Controls model={model} />
      <div className={classes.spacer} />
      <FormGroup row style={{ flexWrap: 'nowrap', marginRight: 7 }}>
        <PanControls model={model} />
        <RefNameAutocomplete
          onSelect={setDisplayedRegion}
          assemblyName={assemblyName}
          value={displayedRegions.length > 1 ? '' : refName}
          model={model}
          TextFieldProps={{
            variant: 'outlined',
            className: classes.headerRefName,
            style: { margin: SPACING, minWidth: '175px' },
            InputProps: {
              style: {
                padding: 0,
                height: WIDGET_HEIGHT,
                background: fade(theme.palette.background.paper, 0.8),
              },
            },
          }}
        />
      </FormGroup>
      <RegionWidth model={model} />
      <ZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )

  if (model.hideHeaderOverview) {
    return controls
  }

  return <OverviewScaleBar model={model}>{controls}</OverviewScaleBar>
})

const RegionWidth = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const { coarseTotalBp } = model
  return (
    <Typography variant="body2" color="textSecondary" className={classes.bp}>
      {`${Math.round(coarseTotalBp).toLocaleString('en-US')} bp`}
    </Typography>
  )
})
