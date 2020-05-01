import { IRegion } from '@gmod/jbrowse-core/mst-types'
import {
  assembleLocString,
  getSession,
  isSessionModelWithDrawerWidgets,
} from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import Icon from '@material-ui/core/Icon'
import { makeStyles, useTheme } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import TextField from '@material-ui/core/TextField'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import ToggleButton from '@material-ui/lab/ToggleButton'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useCallback, useEffect, useRef, useState } from 'react'
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
        isSessionModelWithDrawerWidgets(session) &&
        session.visibleDrawerWidget &&
        session.visibleDrawerWidget.id === 'hierarchicalTrackSelector' &&
        // @ts-ignore
        session.visibleDrawerWidget.view.id === model.id
      }
    >
      <Icon fontSize="small">line_style</Icon>
    </ToggleButton>
  )
})

const Search = observer(({ model }: { model: LGV }) => {
  const [value, setValue] = useState<string | undefined>()
  const [defaultValue, setDefaultValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const classes = useStyles()
  const theme = useTheme()
  const { displayedRegions, dynamicBlocks } = model
  const { blocks } = dynamicBlocks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = getSession(model) as any

  const contentBlocks = blocks.filter(block => block.refName)

  useEffect(() => {
    if (!contentBlocks.length) {
      setDefaultValue('')
      return
    }
    const isSingleAssemblyName = contentBlocks.every(
      block => block.assemblyName === contentBlocks[0].assemblyName,
    )
    const locs = contentBlocks.map(block =>
      assembleLocString({
        ...block,
        start: Math.round(block.start),
        end: Math.round(block.end),
        assemblyName: isSingleAssemblyName ? undefined : block.assemblyName,
      }),
    )
    setDefaultValue(locs.join(';'))
  }, [contentBlocks])

  async function navTo(locString: string) {
    try {
      await model.navToLocString(locString)
    } catch (e) {
      session.pushSnackbarMessage(`${e}`)
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    inputRef && inputRef.current && inputRef.current.blur()
    value && navTo(value)
  }

  function onFocus() {
    setValue(defaultValue)
  }

  function onBlur() {
    setValue(undefined)
  }

  function onChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setValue(event.target.value)
  }

  const setDisplayedRegion = useCallback(
    (region: IRegion | undefined) => {
      if (region) {
        model.setDisplayedRegions([region])
      }
    },
    [model],
  )

  const disabled = displayedRegions.length > 1

  const searchField = (
    <TextField
      inputRef={inputRef}
      onFocus={onFocus}
      onBlur={onBlur}
      className={classes.input}
      variant="outlined"
      margin="dense"
      size="small"
      onChange={event => onChange(event)}
      value={value === undefined ? defaultValue : value}
      InputProps={{
        startAdornment: <Icon fontSize="small">search</Icon>,
        style: {
          background: fade(theme.palette.background.paper, 0.8),
          height: 32,
        },
      }}
      // eslint-disable-next-line react/jsx-no-duplicate-props
      inputProps={{ style: { padding: theme.spacing() } }}
      disabled={disabled}
    />
  )

  const assemblyName = contentBlocks.length
    ? contentBlocks[0].assemblyName
    : undefined
  return (
    <>
      <RefNameAutocomplete
        model={model}
        onSelect={setDisplayedRegion}
        assemblyName={assemblyName}
        defaultRegionName={
          displayedRegions.length > 1 ? '' : contentBlocks[0].refName
        }
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
      <form onSubmit={onSubmit}>
        {disabled ? (
          <Tooltip title="Disabled because this view is displaying multiple regions">
            {searchField}
          </Tooltip>
        ) : (
          searchField
        )}
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
          ).toLocaleString()} bp`}
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
        <Icon>arrow_back</Icon>
      </Button>
      <Button
        size="small"
        variant="outlined"
        className={classes.panButton}
        onClick={() => model.slide(0.9)}
      >
        <Icon>arrow_forward</Icon>
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
