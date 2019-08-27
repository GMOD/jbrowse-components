const dragHandleHeight = 3

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { getRoot } = jbrequire('mobx-state-tree')
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { Icon, IconButton } = jbrequire('@material-ui/core')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const ResizeHandle = jbrequire('@gmod/jbrowse-core/components/ResizeHandle')
  const { assembleLocString } = jbrequire('@gmod/jbrowse-core/util')

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
        <IconButton
          onClick={model.closeView}
          className={classes.iconButton}
          title="close this view"
          data-testid="circular_view_close"
        >
          <Icon fontSize="small">close</Icon>
        </IconButton>

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

        <ToggleButton
          onClick={model.activateTrackSelector}
          title="select tracks"
          selected={
            rootModel.visibleDrawerWidget &&
            rootModel.visibleDrawerWidget.id === 'hierarchicalTrackSelector' &&
            rootModel.visibleDrawerWidget.view.id === model.id
          }
          value="track_select"
          data-testid="circular_track_select"
        >
          <Icon fontSize="small">line_style</Icon>
        </ToggleButton>
      </div>
    )
  })

  function CircularView({ model }) {
    const classes = useStyles()

    return (
      <div className={classes.root} data-testid={model.configuration.configId}>
        <div
          className={classes.scroller}
          style={{
            width: '100%',
            height: `${model.height}px`,
          }}
          onScroll={model.onScroll}
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
      </div>
    )
  }
  CircularView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(CircularView)
}
