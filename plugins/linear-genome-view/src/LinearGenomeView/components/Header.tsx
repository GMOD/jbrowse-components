import { getSession } from '@jbrowse/core/util'
import Button from '@material-ui/core/Button'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { alpha } from '@material-ui/core/styles'
import FormGroup from '@material-ui/core/FormGroup'
import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import React from 'react'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import { LinearGenomeViewModel, HEADER_BAR_HEIGHT } from '..'
import RefNameAutocomplete from './RefNameAutocomplete'
import OverviewScaleBar from './OverviewScaleBar'
import ZoomControls from './ZoomControls'

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
    const { assemblyManager, textSearchManager } = session
    const {
      coarseDynamicBlocks: contentBlocks,
      displayedRegions,
      rankSearchResults,
    } = model
    const { assemblyName, refName } = contentBlocks[0] || { refName: '' }
    const assembly = assemblyName
      ? assemblyManager.get(assemblyName)
      : undefined
    const regions = assembly?.regions || []
    const searchScope = model.searchScope(assemblyName)

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
      return results?.filter(
        (elem, index, self) =>
          index === self.findIndex(t => t.getId() === elem.getId()),
      )
    }

    /**
     * We first check to see if the identifier/label is an appropriate region,
     * if it is then we set that as our displayed region
     * if the label was not a valid region, then
     *  1) we get the trackId and the location/locStr of the option we chose
     *  2) we then use the label to try and fetch for exact matches through our
     * textSearchManager
     *  3) if we get any hits by requerying the textSearchManager, then we either
     *  navigate to the single hit location or pop open the the dialog with all
     *  the results from the search
     *  4) if there were no hits from requerying, then we use (1) the chosen options'
     *  trackId and locStr to navigate and show that track
     *  5) error handling
     * @param result - result chosen from dropdown
     */
    async function setDisplayedRegion(result: BaseResult) {
      if (result) {
        const label = result.getLabel()
        const newRegion = regions.find(region => label === region.refName)
        if (newRegion) {
          model.setDisplayedRegions([newRegion])
          // we use showAllRegions after setDisplayedRegions to make the entire
          // region visible, xref #1703
          model.showAllRegions()
        } else {
          let location = result.getLocation()
          let trackId = result.getTrackId()
          const results = await fetchResults(label)
          if (results && results.length > 1) {
            model.setSearchResults(results, label.toLowerCase())
          } else {
            if (results?.length === 1) {
              location = results[0].getLocation()
              trackId = results[0].getTrackId()
            }
            try {
              label !== '' && model.navToLocString(location)
            } catch (e) {
              if (`${e}` === `Error: Unknown reference sequence "${label}"`) {
                model.setSearchResults(results, label.toLowerCase())
              } else {
                console.warn(e)
                session.notify(`${e}`, 'warning')
              }
            }
            try {
              if (trackId) {
                model.showTrack(trackId)
              }
            } catch (e) {
              console.warn(
                `'${e}' occurred while attempting to show track: ${trackId}`,
              )
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
