const dragHandleHeight = 3

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { getRoot } = jbrequire('mobx-state-tree')
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState, useEffect } = jbrequire('react')

  // material-ui stuff
  const Button = jbrequire('@material-ui/core/Button')
  const Container = jbrequire('@material-ui/core/Container')
  const FormControl = jbrequire('@material-ui/core/FormControl')
  const FormGroup = jbrequire('@material-ui/core/FormGroup')
  const FormLabel = jbrequire('@material-ui/core/FormLabel')
  const Grid = jbrequire('@material-ui/core/Grid')
  const Icon = jbrequire('@material-ui/core/Icon')
  const IconButton = jbrequire('@material-ui/core/IconButton')
  const LinearProgress = jbrequire('@material-ui/core/LinearProgress')
  const MenuItem = jbrequire('@material-ui/core/MenuItem')
  const Select = jbrequire('@material-ui/core/Select')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const Typography = jbrequire('@material-ui/core/Typography')
  const { makeStyles } = jbrequire('@material-ui/core/styles')

  const ResizeHandle = jbrequire('@gmod/jbrowse-core/components/ResizeHandle')
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
        background: '#eee',
        boxSizing: 'border-box',
        borderRight: '1px solid #a2a2a2',
        borderBottom: '1px solid #a2a2a2',
        left: 0,
        top: 0,
      },
      // viewControls: {
      //   height: '100%',
      //   borderBottom: '1px solid #9e9e9e',
      //   boxSizing: 'border-box',
      // },
      // trackControls: {
      //   whiteSpace: 'normal',
      // },
      // zoomControls: {
      //   position: 'absolute',
      //   top: '0px',
      // },
      // iconButton: {
      //   padding: theme.spacing.unit / 2,
      // },
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

  const Controls = observer(({ model }) => {
    const classes = useStyles()
    const rootModel = getRoot(model)

    return (
      <div className={classes.controls}>
        {model.hideCloseButton ? null : (
          <IconButton
            onClick={model.closeView}
            className={classes.iconButton}
            title="close this view"
            data-testid="circular_view_close"
          >
            <Icon fontSize="small">close</Icon>
          </IconButton>
        )}

        <IconButton
          onClick={model.zoomOutButton}
          className={classes.iconButton}
          title="zoom out"
        >
          <Icon fontSize="small">zoom_out</Icon>
        </IconButton>

        <IconButton
          onClick={model.zoomInButton}
          className={classes.iconButton}
          title="zoom in"
        >
          <Icon fontSize="small">zoom_in</Icon>
        </IconButton>

        <IconButton
          onClick={model.rotateCounterClockwiseButton}
          className={classes.iconButton}
          title="rotate counter-clockwise"
        >
          <Icon fontSize="small">rotate_left</Icon>
        </IconButton>

        <IconButton
          onClick={model.rotateClockwiseButton}
          className={classes.iconButton}
          title="rotate clockwise"
        >
          <Icon fontSize="small">rotate_right</Icon>
        </IconButton>

        {model.hideTrackSelectorButton ? null : (
          <ToggleButton
            onClick={model.activateTrackSelector}
            title="select tracks"
            selected={
              rootModel.visibleDrawerWidget &&
              rootModel.visibleDrawerWidget.id ===
                'hierarchicalTrackSelector' &&
              rootModel.visibleDrawerWidget.view.id === model.id
            }
            value="track_select"
            data-testid="circular_track_select"
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
    const [selectedAssembly, setSelectedAssembly] = useState()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState()
    const datasets = getRoot(model).jbrowse.datasets.map(dataset =>
      readConfObject(dataset, 'name'),
    )

    useEffect(() => {
      let finished = false
      async function updateAssembly() {
        setLoading(true)
        const session = getSession(model)
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
        <div style={{ height: 40 }}>
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
                    {datasets.map((name, idx) => (
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
                onClick={() => {
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
  function CircularView({ model }) {
    const classes = useStyles()
    const initialized = !!model.displayedRegions.length

    return (
      <div className={classes.root} data-testid={model.configuration.configId}>
        {!initialized ? (
          <ImportForm model={model} />
        ) : (
          <>
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

            <Controls model={model} />

{model.hideVerticalResizeHandle ? null : (
            <ResizeHandle
              onDrag={model.resizeHeight}
              objectId={model.id}
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
        )}
      </div>
    )
  }
  CircularView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(CircularView)
}
