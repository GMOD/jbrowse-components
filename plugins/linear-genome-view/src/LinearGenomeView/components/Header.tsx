import { Region } from '@gmod/jbrowse-core/util/types'
import { getSession, isSessionModelWithWidgets } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import FormGroup from '@material-ui/core/FormGroup'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useCallback, useRef, useState } from 'react'
import TrackSelectorIcon from '@material-ui/icons/LineStyle'
import SearchIcon from '@material-ui/icons/Search'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import { LinearGenomeViewStateModel, HEADER_BAR_HEIGHT } from '..'
import RefNameAutocomplete from './RefNameAutocomplete'
import OverviewScaleBar from './OverviewScaleBar'
import ZoomControls from './ZoomControls'

type LGV = Instance<LinearGenomeViewStateModel>

const WIDGET_HEIGHT = 27

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
    margin: 7,
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
      title="select tracks"
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
      <TrackSelectorIcon fontSize="small" />
    </ToggleButton>
  )
})

const Search = observer(({ model }: { model: LGV }) => {
  const [value, setValue] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)
  const classes = useStyles()
  const theme = useTheme()
  const { visibleLocStrings } = model
  const session = getSession(model)

  function navTo(locString: string) {
    try {
      model.navToLocString(locString)
    } catch (e) {
      console.warn(e)
      session.notify(`${e}`, 'warning')
    }
  }

  return (
    <form
      style={{ display: 'inline' }}
      onSubmit={event => {
        event.preventDefault()
        inputRef && inputRef.current && inputRef.current.blur()
        value && navTo(value)
      }}
    >
      <TextField
        inputRef={inputRef}
        onFocus={() => setValue(visibleLocStrings)}
        onBlur={() => setValue(undefined)}
        onChange={event => setValue(event.target.value)}
        className={classes.input}
        variant="outlined"
        size="small"
        value={value === undefined ? visibleLocStrings : value}
        InputProps={{
          startAdornment: <SearchIcon fontSize="small" />,
          style: {
            background: fade(theme.palette.background.paper, 0.8),
            margin: 7,
            height: WIDGET_HEIGHT,
          },
        }}
      />
    </form>
  )
})

function PanControls({ model }: { model: LGV }) {
  const classes = useStyles()
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        className={classes.panButton}
        onClick={() => model.slide(-0.9)}
      >
        <ArrowBackIcon />
      </Button>
      <Button
        size="small"
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
  const {
    dynamicBlocks: { contentBlocks },
    displayedRegions,
  } = model

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
      <FormGroup row>
        <PanControls model={model} />
        <RefNameAutocomplete
          style={{
            display: 'inline-flex',
            height: WIDGET_HEIGHT,
            margin: 7,
          }}
          onSelect={setDisplayedRegion}
          assemblyName={assemblyName}
          defaultRegionName={displayedRegions.length > 1 ? '' : refName}
          model={model}
          TextFieldProps={{
            variant: 'outlined',
            size: 'small',
            className: classes.headerRefName,
            InputProps: {
              style: {
                padding: 0,
                height: WIDGET_HEIGHT,
                background: fade(theme.palette.background.paper, 0.8),
              },
            },
          }}
        />
        <Search model={model} />
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
  const { dynamicBlocks } = model
  return (
    <Typography variant="body2" color="textSecondary" className={classes.bp}>
      {`${Math.round(dynamicBlocks.totalBp).toLocaleString('en-US')} bp`}
    </Typography>
  )
})
