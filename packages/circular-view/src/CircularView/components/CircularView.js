import ZoomOut from '@material-ui/icons/ZoomOut'
import ZoomIn from '@material-ui/icons/ZoomIn'
import RotateLeft from '@material-ui/icons/RotateLeft'
import RotateRight from '@material-ui/icons/RotateRight'
import LockOutline from '@material-ui/icons/LockOutlined'
import LockOpen from '@material-ui/icons/LockOpen'
import LineStyle from '@material-ui/icons/LineStyle'

const dragHandleHeight = 3

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const { getSnapshot } = jbrequire('mobx-state-tree')
  const React = jbrequire('react')
  const { useState } = jbrequire('react')

  // material-ui stuff
  const Button = jbrequire('@material-ui/core/Button')
  const Container = jbrequire('@material-ui/core/Container')
  const Grid = jbrequire('@material-ui/core/Grid')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const TextField = jbrequire('@material-ui/core/TextField')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const { grey } = jbrequire('@material-ui/core/colors')

  const { ResizeHandle } = jbrequire('@gmod/jbrowse-core/ui')
  const { assembleLocString, getSession } = jbrequire('@gmod/jbrowse-core/util')
  const Ruler = jbrequire(require('./Ruler'))

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        overflow: 'hidden',
        background: 'white',
      },
      scroller: {
        overflow: 'auto',
      },
      sliceRoot: {
        background: 'none',
        // background: theme.palette.background.paper,
        boxSizing: 'content-box',
        display: 'block',
      },
      iconButton: {
        padding: '4px',
        margin: '0 2px 0 2px',
      },
      controls: {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        position: 'absolute',
        background: grey[200],
        boxSizing: 'border-box',
        borderRight: '1px solid #a2a2a2',
        borderBottom: '1px solid #a2a2a2',
        left: 0,
        top: 0,
      },
      importFormContainer: {
        marginBottom: theme.spacing(4),
      },
    }
  })

  const Slices = observer(({ model }) => {
    return (
      <>
        <>
          {model.staticSlices.map(slice => {
            return (
              <Ruler
                key={assembleLocString(
                  slice.region.elided ? slice.region.regions[0] : slice.region,
                )}
                model={model}
                slice={slice}
              />
            )
          })}
        </>
        <>
          {model.tracks.map(track => {
            return (
              <track.RenderingComponent
                key={track.id}
                track={track}
                view={model}
              />
            )
          })}
        </>
      </>
    )
  })

  const Controls = observer(({ model, showingFigure }) => {
    const classes = useStyles()
    const session = getSession(model)
    return (
      <div className={classes.controls}>
        <IconButton
          onClick={model.zoomOutButton}
          className={classes.iconButton}
          title={model.lockedFitToWindow ? 'unlock to zoom out' : 'zoom out'}
          disabled={
            !showingFigure || model.atMaxBpPerPx || model.lockedFitToWindow
          }
          color="secondary"
        >
          <ZoomOut fontSize="small" />
        </IconButton>

        <IconButton
          onClick={model.zoomInButton}
          className={classes.iconButton}
          title="zoom in"
          disabled={!showingFigure || model.atMinBpPerPx}
          color="secondary"
        >
          <ZoomIn fontSize="small" />
        </IconButton>

        <IconButton
          onClick={model.rotateCounterClockwiseButton}
          className={classes.iconButton}
          title="rotate counter-clockwise"
          disabled={!showingFigure}
          color="secondary"
        >
          <RotateLeft fontSize="small" />
        </IconButton>

        <IconButton
          onClick={model.rotateClockwiseButton}
          className={classes.iconButton}
          title="rotate clockwise"
          disabled={!showingFigure}
          color="secondary"
        >
          <RotateRight fontSize="small" />
        </IconButton>

        <IconButton
          onClick={model.toggleFitToWindowLock}
          className={classes.iconButton}
          title={
            model.lockedFitToWindow
              ? 'locked model to window size'
              : 'unlocked model to zoom further'
          }
          disabled={model.tooSmallToLock}
          color="secondary"
        >
          {model.lockedFitToWindow ? (
            <LockOutline fontSize="small" />
          ) : (
            <LockOpen fontSize="small" />
          )}
        </IconButton>

        {model.hideTrackSelectorButton ? null : (
          <ToggleButton
            onClick={model.activateTrackSelector}
            title="select tracks"
            selected={
              session.visibleWidget &&
              session.visibleWidget.id === 'hierarchicalTrackSelector' &&
              session.visibleWidget.view.id === model.id
            }
            value="track_select"
            data-testid="circular_track_select"
            color="secondary"
          >
            <LineStyle fontSize="small" />
          </ToggleButton>
        )}
      </div>
    )
  })

  const ImportForm = observer(({ model }) => {
    const classes = useStyles()
    const [selectedAssemblyIdx, setSelectedAssemblyIdx] = useState(0)
    const { assemblyNames, assemblyManager } = getSession(model)
    const [assemblyError, setAssemblyError] = useState('')
    if (!assemblyNames.length) {
      setAssemblyError('No configured assemblies')
    }
    const assembly = assemblyManager.get(assemblyNames[selectedAssemblyIdx])
    const regions =
      assembly && assembly.regions ? getSnapshot(assembly.regions) : []

    function onAssemblyChange(event) {
      setSelectedAssemblyIdx(Number(event.target.value))
    }

    function onOpenClick() {
      model.setDisplayedRegions(regions)
    }

    return (
      <>
        <Container className={classes.importFormContainer}>
          <Grid container spacing={1} justify="center" alignItems="center">
            <Grid item>
              <TextField
                select
                value={
                  assemblyNames[selectedAssemblyIdx] && !assemblyError
                    ? selectedAssemblyIdx
                    : ''
                }
                onChange={onAssemblyChange}
                helperText={assemblyError || 'Select assembly to view'}
                error={!!assemblyError}
                disabled={!!assemblyError}
                margin="normal"
              >
                {assemblyNames.map((name, idx) => (
                  <MenuItem key={name} value={idx}>
                    {name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item>
              <Button
                disabled={!(regions && regions.length)}
                onClick={onOpenClick}
                variant="contained"
                color="primary"
              >
                {regions.length ? 'Open' : 'Loading…'}
              </Button>
            </Grid>
          </Grid>
        </Container>
      </>
    )
  })

  function CircularView({ model }) {
    const classes = useStyles()
    const initialized =
      !!model.displayedRegions.length && model.figureWidth && model.figureHeight

    const showImportForm = !initialized && !model.disableImportForm
    const showFigure = initialized && !showImportForm

    return (
      <div
        className={classes.root}
        style={{
          width: model.width,
          height: model.height,
        }}
        data-testid={model.id}
      >
        {model.error ? (
          <p style={{ color: 'red' }}>{model.error.message}</p>
        ) : (
          <>
            {showImportForm ? <ImportForm model={model} /> : null}
            <>
              {!showFigure ? null : (
                <div
                  className={classes.scroller}
                  style={{
                    width: model.width,
                    height: model.height,
                  }}
                >
                  <div
                    className={classes.rotator}
                    style={{
                      transform: [`rotate(${model.offsetRadians}rad)`].join(
                        ' ',
                      ),
                      transition: 'transform 0.5s',
                      transformOrigin: model.centerXY
                        .map(x => `${x}px`)
                        .join(' '),
                    }}
                  >
                    <svg
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                      }}
                      className={classes.sliceRoot}
                      width={`${model.figureWidth}px`}
                      height={`${model.figureHeight}px`}
                      version="1.1"
                    >
                      <g transform={`translate(${model.centerXY})`}>
                        <Slices model={model} />
                      </g>
                    </svg>
                  </div>
                </div>
              )}
              <Controls model={model} showingFigure={showFigure} />
              {model.hideVerticalResizeHandle ? null : (
                <ResizeHandle
                  onDrag={model.resizeHeight}
                  style={{
                    height: dragHandleHeight,
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    background: '#ccc',
                    boxSizing: 'border-box',
                    borderTop: '1px solid #fafafa',
                  }}
                />
              )}
            </>
          </>
        )}
      </div>
    )
  }
  CircularView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(CircularView)
}
