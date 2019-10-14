import ResizeHandle from '@gmod/jbrowse-core/components/ResizeHandle'
import { generateLocString } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import InputBase from '@material-ui/core/InputBase'
import Menu from '@material-ui/core/Menu'
import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import Select from '@material-ui/core/Select'
import { makeStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import clsx from 'clsx'
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import ReactPropTypes from 'prop-types'
import React, { useState, CSSProperties } from 'react'
import buttonStyles from './buttonStyles'
import Rubberband from './Rubberband'
import ScaleBar from './ScaleBar'
import TrackRenderingContainer from './TrackRenderingContainer'
import ZoomControls from './ZoomControls'
import { LinearGenomeViewStateModel, LGVMenuOption } from '..'
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
    borderBottom: '1px solid #9e9e9e',
    boxSizing: 'border-box',
  },
  trackControls: {
    whiteSpace: 'normal',
  },
  headerBar: {
    gridArea: '1/1/auto/span 2',
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
  ({ model, track }: { model: LGV; track: Instance<BaseTrackStateModel> }) => {
    const classes = useStyles()
    const { bpPerPx, offsetPx } = model
    const { RenderingComponent } = track
    return (
      <>
        <div
          className={clsx(classes.controls, classes.trackControls)}
          key={`controls:${track.id}`}
          style={{ gridRow: `track-${track.id}`, gridColumn: 'controls' }}
        >
          <track.ControlsComponent
            track={track}
            key={track.id}
            view={model}
            onConfigureClick={track.activateConfigurationUI}
          />
        </div>
        <TrackRenderingContainer
          key={`track-rendering:${track.id}`}
          trackId={track.id}
          height={track.height}
          onHorizontalScroll={model.horizontalScroll}
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
          key={`handle:${track.id}`}
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
          {model.menuOptions.map((option: LGVMenuOption) => (
            <MenuItem
              key={option.key}
              onClick={() => {
                option.callback()
                handleClose()
              }}
            >
              {option.title}
            </MenuItem>
          ))}
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
      value="Select refSeq"
      name="refseq"
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
      <LongMenu className={classes.iconButton} model={model} />
    </>
  )
})

function LinearGenomeView({ model }: { model: LGV }) {
  const { id, staticBlocks, tracks, bpPerPx, controlsWidth, offsetPx } = model
  const classes = useStyles()

  /*
   * NOTE: offsetPx is the total offset in px of the viewing window into the
   * whole set of concatenated regions. this number is often quite large.
   */
  const style = {
    display: 'grid',
    position: 'relative',
    gridTemplateRows: `${
      !model.hideHeader ? '[header] auto ' : ''
    } [scale-bar] auto ${tracks
      .map(
        t =>
          `[track-${t.id}] ${t.height}px [resize-${t.id}] ${dragHandleHeight}px`,
      )
      .join(' ')}`,
    gridTemplateColumns: `[controls] ${controlsWidth}px [blocks] auto`,
  } as React.CSSProperties

  return (
    <div className={classes.root}>
      <div
        className={classes.linearGenomeView}
        key={`view-${id}`}
        style={style}
      >
        {!model.hideHeader ? <Header model={model} /> : null}
        <div
          className={clsx(classes.controls, classes.viewControls)}
          style={{ gridRow: 'scale-bar' }}
        >
          {model.hideControls || !model.hideHeader ? null : (
            <Controls model={model} />
          )}
        </div>

        <Rubberband
          style={{
            gridColumn: 'blocks',
            gridRow: 'scale-bar',
          }}
          offsetPx={offsetPx}
          blocks={staticBlocks}
          bpPerPx={bpPerPx}
          model={model}
        >
          <ScaleBar model={model} height={32} />
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
      </div>
    </div>
  )
}
export default observer(LinearGenomeView)
