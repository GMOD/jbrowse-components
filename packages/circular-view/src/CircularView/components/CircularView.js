const dragHandleHeight = 3

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { getRoot } = jbrequire('mobx-state-tree')
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = jbrequire('react')

  // material-ui stuff
  const Button = jbrequire('@material-ui/core/Button')
  const Container = jbrequire('@material-ui/core/Container')
  const FormControl = jbrequire('@material-ui/core/FormControl')
  const FormGroup = jbrequire('@material-ui/core/FormGroup')
  const FormLabel = jbrequire('@material-ui/core/FormLabel')
  const Grid = jbrequire('@material-ui/core/Grid')
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const Select = jbrequire('@material-ui/core/Select')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const { grey } = jbrequire('@material-ui/core/colors')

  const { ResizeHandle } = jbrequire('@gmod/jbrowse-core/ui')
  const { assembleLocString, getSession } = jbrequire('@gmod/jbrowse-core/util')
  const { readConfObject } = jbrequire('@gmod/jbrowse-core/configuration')
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
        {model.hideCloseButton ? null : (
          <IconButton
            onClick={model.closeView}
            className={classes.iconButton}
            title="close this view"
            data-testid="circular_view_close"
            color="secondary"
          >
            <Icon fontSize="small">close</Icon>
          </IconButton>
        )}

        <IconButton
          onClick={model.zoomOutButton}
          className={classes.iconButton}
          title={model.lockedFitToWindow ? 'unlock to zoom out' : 'zoom out'}
          disabled={
            !showingFigure || model.atMaxBpPerPx || model.lockedFitToWindow
          }
          color="secondary"
        >
          <Icon fontSize="small">zoom_out</Icon>
        </IconButton>

        <IconButton
          onClick={model.zoomInButton}
          className={classes.iconButton}
          title="zoom in"
          disabled={!showingFigure || model.atMinBpPerPx}
          color="secondary"
        >
          <Icon fontSize="small">zoom_in</Icon>
        </IconButton>

        <IconButton
          onClick={model.rotateCounterClockwiseButton}
          className={classes.iconButton}
          title="rotate counter-clockwise"
          disabled={!showingFigure}
          color="secondary"
        >
          <Icon fontSize="small">rotate_left</Icon>
        </IconButton>

        <IconButton
          onClick={model.rotateClockwiseButton}
          className={classes.iconButton}
          title="rotate clockwise"
          disabled={!showingFigure}
          color="secondary"
        >
          <Icon fontSize="small">rotate_right</Icon>
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
            <Icon fontSize="small">lock_outline</Icon>
          ) : (
            <Icon fontSize="small">lock_open</Icon>
          )}
        </IconButton>

        {model.hideTrackSelectorButton ? null : (
          <ToggleButton
            onClick={model.activateTrackSelector}
            title="select tracks"
            selected={
              session.visibleDrawerWidget &&
              session.visibleDrawerWidget.id === 'hierarchicalTrackSelector' &&
              session.visibleDrawerWidget.view.id === model.id
            }
            value="track_select"
            data-testid="circular_track_select"
            color="secondary"
          >
            <Icon fontSize="small">line_style</Icon>
          </ToggleButton>
        )}
      </div>
    )
  })

  // note: as of writing, this is identifical (except without typescript) to lineargenomeview
  // if modified, consider refactoring or updating lineargenomeviews copy
  // not extracted to a separate component just yet...
  const ImportForm = observer(({ model }) => {
    const classes = useStyles()
    const [selectedDatasetIdx, setSelectedDatasetIdx] = useState('')
    const { datasets } = getRoot(model).jbrowse
    const datasetChoices = datasets.map(dataset =>
      readConfObject(dataset, 'name'),
    )
    function openButton() {
      if (parseInt(selectedDatasetIdx, 10) >= 0) {
        const dataset = datasets[Number(selectedDatasetIdx)]
        if (dataset) {
          const assemblyName = readConfObject(dataset.assembly, 'name')
          if (
            assemblyName &&
            assemblyName !== model.displayRegionsFromAssemblyName
          ) {
            model.setDisplayedRegionsFromAssemblyName(assemblyName)
            return
          }
        }
      }
      model.setDisplayedRegions([])
      model.setDisplayedRegionsFromAssemblyName(undefined)
    }

    return (
      <>
        {model.hideCloseButton ? null : (
          <div style={{ height: 40 }}>
            <IconButton
              onClick={model.closeView}
              className={classes.iconButton}
              title="close this view"
              color="secondary"
            >
              <Icon>close</Icon>
            </IconButton>
          </div>
        )}
        <Container className={classes.importFormContainer}>
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
                    {datasetChoices.map((name, idx) => (
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
                onClick={openButton}
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
                  transform: [`rotate(${model.offsetRadians}rad)`].join(' '),
                  transition: 'transform 0.5s',
                  transformOrigin: model.centerXY.map(x => `${x}px`).join(' '),
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
      </div>
    )
  }
  CircularView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(CircularView)
}
