import { getSession } from '@jbrowse/core/util'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import Button from '@material-ui/core/Button'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import FormGroup from '@material-ui/core/FormGroup'
import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import { Instance, getEnv } from 'mobx-state-tree'
import React from 'react'

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
  buttonSpacer: {
    marginRight: theme.spacing(2),
  },
}))

const Controls = observer(({ model }: { model: LGV }) => {
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

const RegionWidth = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const { coarseTotalBp } = model
  return (
    <Typography variant="body2" color="textSecondary" className={classes.bp}>
      {`${Math.round(coarseTotalBp).toLocaleString('en-US')} bp`}
    </Typography>
  )
})

const LinearGenomeViewHeader = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const theme = useTheme()
  const session = getSession(model)
  const { assemblyManager } = session
  const { pluginManager } = getEnv(session)
  const { textSearchManager } = pluginManager.rootModel
  const {
    coarseDynamicBlocks: contentBlocks,
    displayedRegions,
    rankSearchResults,
  } = model
  const { assemblyName, refName } = contentBlocks[0] || { refName: '' }
  const assembly = assemblyName && assemblyManager.get(assemblyName)
  const regions = (assembly && assembly.regions) || []
  const searchScope = model.searchScope(assemblyName)
  async function setDisplayedRegion(result: BaseResult) {
    if (result) {
      const newRegionValue = result.getLocation()
      // need to fix finding region
      const newRegion = regions.find(
        region => newRegionValue === region.refName,
      )
      if (newRegion) {
        model.setDisplayedRegions([newRegion])
        // we use showAllRegions after setDisplayedRegions to make the entire
        // region visible, xref #1703
        model.showAllRegions()
      } else {
        const results =
          (await textSearchManager?.search(
            {
              queryString: newRegionValue.toLocaleLowerCase(),
              searchType: 'exact',
            },
            searchScope,
            rankSearchResults,
          )) || []
        // distinguishes between locstrings and search strings
        if (results.length > 0) {
          model.setSearchResults(results, newRegionValue.toLocaleLowerCase())
        } else {
          try {
            newRegionValue !== '' && model.navToLocString(newRegionValue)
          } catch (e) {
            if (
              `${e}` === `Error: Unknown reference sequence "${newRegionValue}"`
            ) {
              model.setSearchResults(
                results,
                newRegionValue.toLocaleLowerCase(),
              )
            } else {
              console.warn(e)
              session.notify(`${e}`, 'warning')
            }
          }
        }
      }
    }
  }

  const controls = (
    <div className={classes.headerBar}>
      <Controls model={model} />
      <div className={classes.spacer} />
      <FormGroup row className={classes.headerForm}>
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

export default LinearGenomeViewHeader
