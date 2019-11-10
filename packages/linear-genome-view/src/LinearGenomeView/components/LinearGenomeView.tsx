import ResizeHandle from '@gmod/jbrowse-core/components/ResizeHandle'
import { generateLocString, getSession } from '@gmod/jbrowse-core/util'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { IRegion } from '@gmod/jbrowse-core/mst-types'

// material ui things
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Checkbox from '@material-ui/core/Checkbox'
import Container from '@material-ui/core/Container'
import FormControl from '@material-ui/core/FormControl'
import FormLabel from '@material-ui/core/FormLabel'
import FormGroup from '@material-ui/core/FormGroup'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Grid from '@material-ui/core/Grid'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputBase from '@material-ui/core/InputBase'
import LinearProgress from '@material-ui/core/LinearProgress'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import Select from '@material-ui/core/Select'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'

// misc
import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance, getRoot } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useEffect, useState } from 'react'

// locals
import buttonStyles from './buttonStyles'
import Rubberband from './Rubberband'
import ScaleBar from './ScaleBar'
import TrackRenderingContainer from './TrackRenderingContainer'
import ZoomControls from './ZoomControls'
import {
  LinearGenomeViewStateModel,
  HEADER_BAR_HEIGHT,
  SCALE_BAR_HEIGHT,
} from '..'
import { BaseTrackStateModel } from '../../BasicTrack/baseTrackModel'

const dragHandleHeight = 3

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
  },
  linearGenomeView: {
    background: '#eee',
    // background: theme.palette.background.paper,
    boxSizing: 'content-box',
  },
  controls: {
    borderRight: '1px solid gray',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  viewControls: {
    height: '100%',
    zIndex: 10,
    background: '#eee',
    borderBottom: '1px solid #9e9e9e',
    boxSizing: 'border-box',
  },
  trackControls: {
    whiteSpace: 'normal',
  },
  headerBar: {
    gridArea: '1/1/auto/span 2',
    height: HEADER_BAR_HEIGHT,
    display: 'flex',
  },
  spacer: {
    flexGrow: 1,
  },
  navbox: {
    margin: theme.spacing(1),
  },
  emphasis: {
    background: '#dddd',
    padding: theme.spacing(1),
  },
  searchRoot: {
    margin: theme.spacing(1),
    alignItems: 'center',
  },
  viewName: {
    margin: theme.spacing(0.25),
  },
  zoomControls: {
    position: 'absolute',
    top: 0,
  },
  hovered: {
    border: '1px solid grey',
  },
  input: {
    width: 300,
    error: {
      backgroundColor: 'red',
    },
  },
  ...buttonStyles(theme),
}))

const TrackContainer = observer(
  (props: { model: LGV; track: Instance<BaseTrackStateModel> }) => {
    const { model, track } = props
    const classes = useStyles()
    const { bpPerPx, offsetPx } = model
    const { RenderingComponent, ControlsComponent } = track
    return (
      <>
        <div
          className={clsx(classes.controls, classes.trackControls)}
          style={{ gridRow: `track-${track.id}`, gridColumn: 'controls' }}
        >
          <ControlsComponent
            track={track}
            view={model}
            onConfigureClick={track.activateConfigurationUI}
          />
        </div>
        <TrackRenderingContainer
          trackId={track.id}
          onHorizontalScroll={model.horizontalScroll}
          setScrollTop={track.setScrollTop}
        >
          <RenderingComponent
            model={track}
            offsetPx={offsetPx}
            bpPerPx={bpPerPx}
            blockState={{}}
            onHorizontalScroll={model.horizontalScroll}
          />
        </TrackRenderingContainer>
        <ResizeHandle
          onDrag={track.resizeHeight}
          style={{
            gridRow: `resize-${track.id}`,
            gridColumn: 'span 2',
            background: '#ccc',
            boxSizing: 'border-box',
            borderTop: '1px solid #fafafa',
          }}
        />
      </>
    )
  },
)

const LongMenu = observer(
  ({ model, className }: { model: LGV; className: string }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const open = Boolean(anchorEl)

    function handleClick(event: React.MouseEvent<HTMLElement>) {
      setAnchorEl(event.currentTarget)
    }

    function handleClose() {
      setAnchorEl(null)
    }

    return (
      <>
        <IconButton
          aria-label="more"
          aria-controls="long-menu"
          aria-haspopup="true"
          className={className}
          onClick={handleClick}
        >
          <Icon>more_vert</Icon>
        </IconButton>
        <Menu
          id="long-menu"
          anchorEl={anchorEl}
          keepMounted
          open={open}
          onClose={handleClose}
        >
          {model.menuOptions.map(option => {
            return option.isCheckbox ? (
              <MenuItem key={option.key}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={option.checked}
                      onChange={() => {
                        option.callback()
                        handleClose()
                      }}
                    />
                  }
                  label={option.title}
                />
              </MenuItem>
            ) : (
              <MenuItem
                key={option.key}
                onClick={() => {
                  option.callback()
                  handleClose()
                }}
              >
                {option.title}
              </MenuItem>
            )
          })}
        </Menu>
      </>
    )
  },
)

const TextFieldOrTypography = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const name = model.displayName || model.displayRegionsFromAssemblyName
  const [edit, setEdit] = useState(false)
  const [hover, setHover] = useState(false)
  return edit ? (
    <form
      onSubmit={event => {
        setEdit(false)
        event.preventDefault()
      }}
    >
      <TextField
        value={name}
        onChange={event => {
          model.setDisplayName(event.target.value)
        }}
        onBlur={() => {
          setEdit(false)
          model.setDisplayName(name || '')
        }}
      />
    </form>
  ) : (
    <div className={clsx(classes.emphasis, hover ? classes.hovered : null)}>
      <Typography
        className={classes.viewName}
        onClick={() => setEdit(true)}
        onMouseOver={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {name}
      </Typography>
    </div>
  )
})

function Search({
  onSubmit,
  error,
}: {
  onSubmit: Function
  error: string | undefined
}) {
  const [value, setValue] = useState<string | undefined>()
  const classes = useStyles()
  const placeholder = 'Enter location (e.g. chr1:1000..5000)'

  return (
    <Paper className={classes.searchRoot}>
      <form
        onSubmit={event => {
          onSubmit(value)
          event.preventDefault()
        }}
      >
        <InputBase
          className={classes.input}
          error={!!error}
          onChange={event => setValue(event.target.value)}
          placeholder={placeholder}
        />
        <IconButton
          onClick={() => onSubmit(value)}
          className={classes.iconButton}
          aria-label="search"
        >
          <Icon>search</Icon>
        </IconButton>
      </form>
    </Paper>
  )
}
Search.propTypes = {
  onSubmit: ReactPropTypes.func.isRequired,
  error: ReactPropTypes.string, // eslint-disable-line react/require-default-props
}

const RefSeqDropdown = observer(({ model, onSubmit }) => {
  const tied = !!model.displayRegionsFromAssemblyName
  return (
    <Select
      name="refseq"
      value=""
      onChange={event => {
        if (event.target.value !== '') {
          onSubmit(event.target.value)
        }
      }}
    >
      {model.displayedRegions.map((r: IRegion) => {
        const l = generateLocString(r, tied)
        return (
          <MenuItem key={l} value={l}>
            {l}
          </MenuItem>
        )
      })}
    </Select>
  )
})

const Header = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const [error, setError] = useState<string | undefined>()
  const navTo = (locstring: string) => {
    if (!model.navToLocstring(locstring)) {
      setError(`Unable to navigate to ${locstring}`)
    } else {
      setError(undefined)
    }
  }
  return (
    <div className={classes.headerBar}>
      {model.hideControls ? null : <Controls model={model} />}
      <TextFieldOrTypography model={model} />
      <div className={classes.spacer} />

      <Search onSubmit={navTo} error={error} />
      <RefSeqDropdown onSubmit={navTo} model={model} />

      <ZoomControls model={model} />
      <div className={classes.spacer} />
    </div>
  )
})

const Controls = observer(({ model }) => {
  const classes = useStyles()
  return (
    <>
      <IconButton
        onClick={model.closeView}
        className={classes.iconButton}
        title="close this view"
      >
        <Icon fontSize="small">close</Icon>
      </IconButton>

      <IconButton
        onClick={model.activateTrackSelector}
        title="select tracks"
        value="track_select"
      >
        <Icon fontSize="small">line_style</Icon>
      </IconButton>
      <LongMenu className={classes.iconButton} model={model} />
    </>
  )
})

// note: as of writing, this is identifical (except with typescript) to circularview's copy
// if modified, consider refactoring or updating circularview's copy
// not extracted to a separate component just yet...
const ImportForm = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const [selectedDatasetIdx, setSelectedDatasetIdx] = useState('')
  const [selectedAssembly, setSelectedAssembly] = useState()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState()
  const datasets = getRoot(model).jbrowse.datasets.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dataset: any, idx: number) => readConfObject(dataset, 'name'),
  )

  useEffect(() => {
    let finished = false
    async function updateAssembly() {
      setLoading(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = getSession(model) as any
      const displayedRegions = await session.getRegionsForAssembly(
        selectedAssembly,
        session.assemblyData,
      )
      // note: we cannot just use setDisplayRegionsFromAssemblyName because
      // it uses an autorun that does not respond to updates to
      // the displayRegionsFromAssembly name (only to changes to the self.views array)
      // see sessionModelFactory
      if (!finished) {
        model.setDisplayedRegions(displayedRegions || [], true)
        model.setDisplayName(selectedAssembly)
      }
    }
    try {
      if (selectedAssembly) {
        updateAssembly()
      }
    } catch (e) {
      if (!finished) {
        setError(e.message)
      }
    }
    return () => {
      finished = true
    }
  }, [model, selectedAssembly])
  return (
    <>
      <div style={{ height: HEADER_BAR_HEIGHT }}>
        <IconButton
          onClick={model.closeView}
          className={classes.iconButton}
          title="close this view"
        >
          <Icon fontSize="small">close</Icon>
        </IconButton>
      </div>
      <Container>
        {error ? (
          <Typography style={{ color: 'red' }}>{error}</Typography>
        ) : null}
        {loading ? <LinearProgress /> : null}
        <Grid
          style={{ width: '25rem', margin: '0 auto' }}
          container
          spacing={1}
          direction="row"
          alignItems="flex-start"
        >
          <Grid item>
            <FormControl component="fieldset">
              <FormLabel component="legend">Select dataset to view</FormLabel>
              <FormGroup>
                <Select
                  value={selectedDatasetIdx}
                  onChange={event => {
                    setSelectedDatasetIdx(String(event.target.value))
                  }}
                >
                  {datasets.map((name: string, idx: number) => (
                    <MenuItem key={name} value={idx}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormGroup>
            </FormControl>
          </Grid>
          <Grid item>
            <Button
              disabled={selectedDatasetIdx === undefined}
              onClick={event => {
                const assemblyName = readConfObject(
                  getRoot(model).jbrowse.datasets[Number(selectedDatasetIdx)]
                    .assembly,
                  'name',
                )
                setSelectedAssembly(assemblyName)
              }}
              variant="contained"
              color="primary"
            >
              Open
            </Button>
          </Grid>
        </Grid>
      </Container>
    </>
  )
})

const LinearGenomeView = observer((props: { model: LGV }) => {
  const { model } = props
  const { tracks, controlsWidth } = model
  const classes = useStyles()

  const initialized =
    !!model.displayedRegions.length || !!model.displayRegionsFromAssemblyName
  const style = (initialized
    ? {
        display: 'grid',
        position: 'relative',
        gridTemplateRows: `${
          !model.hideHeader ? '[header] auto ' : ''
        } [scale-bar] ${SCALE_BAR_HEIGHT}px ${tracks
          .map(
            t =>
              `[track-${t.id}] ${t.height}px [resize-${t.id}] ${dragHandleHeight}px`,
          )
          .join(' ')}`,
        gridTemplateColumns: `[controls] ${controlsWidth}px [blocks] auto`,
      }
    : {}) as React.CSSProperties

  return (
    <div className={classes.root}>
      <div className={classes.linearGenomeView} style={style}>
        {!initialized ? (
          <ImportForm model={model} />
        ) : (
          <>
            {!model.hideHeader ? <Header model={model} /> : null}
            <div
              className={clsx(classes.controls, classes.viewControls)}
              style={{ gridRow: 'scale-bar' }}
            >
              {model.hideControls || !model.hideHeader ? null : (
                <Controls model={model} />
              )}
            </div>

            <Rubberband height={SCALE_BAR_HEIGHT} model={model}>
              <ScaleBar model={model} height={SCALE_BAR_HEIGHT} />
            </Rubberband>

            {model.hideHeader ? (
              <div
                className={classes.zoomControls}
                style={{
                  right: 4,
                  zIndex: 1000,
                }}
              >
                <ZoomControls model={model} />
              </div>
            ) : null}
            {tracks.map(track => (
              <TrackContainer key={track.id} model={model} track={track} />
            ))}
          </>
        )}
      </div>
    </div>
  )
})
export default LinearGenomeView
