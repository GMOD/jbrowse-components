import { Region } from '@gmod/jbrowse-core/util/types'
import {
  getSession,
  isSessionModelWithWidgets,
  parseLocString,
} from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { observer } from 'mobx-react'
import { getSnapshot, Instance } from 'mobx-state-tree'
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

const useStyles = makeStyles(theme => ({
  headerBar: {
    height: HEADER_BAR_HEIGHT,
    display: 'flex',
  },
  spacer: {
    flexGrow: 1,
  },
  input: {
    width: 300,
    padding: theme.spacing(0, 1),
  },
  headerRefName: {
    minWidth: 100,
    margin: theme.spacing(2, 0, 1),
  },
  panButton: {
    margin: theme.spacing(2),
    background: fade(theme.palette.background.paper, 0.8),
  },
  bp: {
    display: 'flex',
    alignItems: 'center',
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
  const {
    dynamicBlocks: { contentBlocks },
    displayedRegions,
    visibleLocStrings,
    setDisplayedRegions,
  } = model
  const session = getSession(model)

  function navTo(locString: string) {
    try {
      const { assemblyManager } = session
      const { isValidRefName } = assemblyManager
      const locStrings = locString.split(';')
      if (displayedRegions.length === 1) {
        const displayedRegion = displayedRegions[0]
        let assembly = assemblyManager.get(displayedRegion.assemblyName)
        if (!assembly) {
          throw new Error(
            `Could not find assembly ${displayedRegion.assemblyName}`,
          )
        }
        const { regions } = assembly
        if (!regions) {
          throw new Error(
            `Regions for assembly ${displayedRegion.assemblyName} not yet loaded`,
          )
        }
        const matchedRegion = regions.find(
          region =>
            region.refName === displayedRegion.refName &&
            region.start === displayedRegion.start &&
            region.end === displayedRegion.end,
        )
        if (matchedRegion) {
          if (locStrings.length > 1) {
            throw new Error(
              'Navigating to multiple locations is not allowed when viewing a whole chromosome',
            )
          }
          const parsedLocString = parseLocString(locStrings[0], isValidRefName)
          let changedAssembly = false
          if (
            parsedLocString.assemblyName &&
            parsedLocString.assemblyName !== displayedRegion.assemblyName
          ) {
            const newAssembly = assemblyManager.get(
              parsedLocString.assemblyName,
            )
            if (!newAssembly) {
              throw new Error(
                `Could not find assembly ${parsedLocString.assemblyName}`,
              )
            }
            assembly = newAssembly
            changedAssembly = true
          }
          const canonicalRefName = assembly.getCanonicalRefName(
            parsedLocString.refName,
          )
          if (!canonicalRefName) {
            throw new Error(
              `Could not find refName ${parsedLocString.refName} in ${assembly.name}`,
            )
          }
          if (changedAssembly || canonicalRefName !== displayedRegion.refName) {
            const newDisplayedRegion = regions.find(
              region => region.refName === canonicalRefName,
            )
            if (newDisplayedRegion) {
              setDisplayedRegions([getSnapshot(newDisplayedRegion)])
            } else {
              throw new Error(
                `Could not find refName ${parsedLocString.refName} in ${assembly.name}`,
              )
            }
          }
          model.navTo(parsedLocString)
          return
        }
      }
      model.navToLocStrings(locString)
    } catch (e) {
      console.warn(e)
      session.notify(`${e}`, 'warning')
    }
  }

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
  return (
    <>
      <RefNameAutocomplete
        model={model}
        onSelect={setDisplayedRegion}
        assemblyName={assemblyName}
        defaultRegionName={displayedRegions.length > 1 ? '' : refName}
        TextFieldProps={{
          variant: 'outlined',
          margin: 'dense',
          size: 'small',
          className: classes.headerRefName,
          InputProps: {
            style: {
              paddingTop: 2,
              paddingBottom: 2,
              background: fade(theme.palette.background.paper, 0.8),
            },
          },
        }}
      />
      <form
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
          margin="dense"
          size="small"
          value={value === undefined ? visibleLocStrings : value}
          InputProps={{
            startAdornment: <SearchIcon fontSize="small" />,
            style: {
              background: fade(theme.palette.background.paper, 0.8),
              height: 32,
            },
          }}
          // eslint-disable-next-line react/jsx-no-duplicate-props
          inputProps={{ style: { padding: theme.spacing() } }}
        />
      </form>
      <div className={classes.bp}>
        <Typography
          variant="body2"
          color="textSecondary"
          className={classes.bp}
        >
          {`${Math.round(
            contentBlocks
              .map(block => block.end - block.start)
              .reduce(
                (previousValue, currentValue) => previousValue + currentValue,
                0,
              ),
          ).toLocaleString('en-US')} bp`}
        </Typography>
      </div>
    </>
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

  const controls = (
    <div className={classes.headerBar}>
      <Controls model={model} />
      <div className={classes.spacer} />
      <PanControls model={model} />
      <Search model={model} />
      <ZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )

  if (model.hideHeaderOverview) {
    return controls
  }

  return <OverviewScaleBar model={model}>{controls}</OverviewScaleBar>
})
