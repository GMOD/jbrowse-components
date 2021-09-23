import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  FormGroup,
  Typography,
  makeStyles,
  useTheme,
  alpha,
} from '@material-ui/core'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

// icons
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'

// locals
import { LinearGenomeViewModel, HEADER_BAR_HEIGHT } from '..'
import RefNameAutocomplete from './RefNameAutocomplete'
import OverviewScaleBar from './OverviewScaleBar'
import ZoomControls from './ZoomControls'
import { dedupe } from './util'

const WIDGET_HEIGHT = 32
const SPACING = 7

const useStyles = makeStyles(theme => ({
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
  input: {},
  headerRefName: {
    minWidth: 100,
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

const Controls = observer(({ model }: { model: LinearGenomeViewModel }) => {
  const classes = useStyles()
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

function PanControls({ model }: { model: LinearGenomeViewModel }) {
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

const RegionWidth = observer(({ model }: { model: LinearGenomeViewModel }) => {
  const classes = useStyles()
  const { coarseTotalBp } = model
  return (
    <Typography variant="body2" color="textSecondary" className={classes.bp}>
      {`${Math.round(coarseTotalBp).toLocaleString('en-US')} bp`}
    </Typography>
  )
})

const LinearGenomeViewHeader = observer(
  ({ model }: { model: LinearGenomeViewModel }) => {
    const classes = useStyles()
    const theme = useTheme()
    const session = getSession(model)

    const { textSearchManager } = session
    const {
      coarseDynamicBlocks: contentBlocks,
      displayedRegions,
      rankSearchResults,
    } = model
    const { assemblyName, refName } = contentBlocks[0] || { refName: '' }
    const searchScope = model.searchScope(assemblyName)
    const displayVal = displayedRegions.length > 1 ? '' : refName

    async function fetchResults(queryString: string) {
      if (!textSearchManager) {
        console.warn('No text search manager')
      }
      const results = await textSearchManager?.search(
        {
          queryString: queryString.toLowerCase(),
          searchType: 'exact',
        },
        searchScope,
        rankSearchResults,
      )
      return dedupe(results)
    }

    async function handleSelectedRegion(option: BaseResult) {
      let trackId = option.getTrackId()
      let location = option.getLocation()
      const label = option.getLabel()
      try {
        const results = await fetchResults(label)
        if (results && results.length > 1) {
          model.setSearchResults(results, label.toLowerCase())
        } else if (results?.length === 1) {
          location = results[0].getLocation()
          trackId = results[0].getTrackId()
        }
        model.navToLocString(location, assemblyName)
        if (trackId) {
          model.showTrack(trackId)
        }
      } catch (e) {
        console.error(e)
        session.notify(`${e}`, 'warning')
      }
    }
    const controls = (
      <div className={classes.headerBar}>
        <Controls model={model} />
        <div className={classes.spacer} />
        <FormGroup row className={classes.headerForm}>
          <PanControls model={model} />
          <RefNameAutocomplete
            onSelect={handleSelectedRegion}
            assemblyName={assemblyName}
            value={displayVal}
            model={model}
            TextFieldProps={{
              variant: 'outlined',
              className: classes.headerRefName,
              style: { margin: SPACING, minWidth: '175px' },
              InputProps: {
                style: {
                  padding: 0,
                  height: WIDGET_HEIGHT,
                  background: alpha(theme.palette.background.paper, 0.8),
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
  },
)

export default LinearGenomeViewHeader
