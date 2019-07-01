const dragHandleHeight = 3

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { getRoot } = jbrequire('mobx-state-tree')
  const { PropTypes } = jbrequire('mobx-react')
  const { observer } = jbrequire('mobx-react-lite')
  const ReactPropTypes = jbrequire('prop-types')
  const React = jbrequire('react')
  const { withStyles, Icon, IconButton } = jbrequire('@material-ui/core')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const ResizeHandleHorizontal = jbrequire(
    '@gmod/jbrowse-core/components/ResizeHandleHorizontal',
  )
  const { assembleLocString } = jbrequire('@gmod/jbrowse-core/util')

  const Ruler = jbrequire(require('./Ruler'))

  const styles = theme => ({
    root: {
      position: 'relative',
      marginBottom: theme.spacing.unit,
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
  })

  const Slices = withStyles(styles)(
    observer(({ classes, model }) => {
      return (
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
      )
    }),
  )

  const Controls = withStyles(styles)(
    observer(function Controls({ classes, model }) {
      const rootModel = getRoot(model)

      return (
        <div className={classes.controls}>
          <IconButton
            onClick={model.closeView}
            className={classes.iconButton}
            title="close this view"
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
              rootModel.visibleDrawerWidget.id ===
                'hierarchicalTrackSelector' &&
              rootModel.visibleDrawerWidget.view.id === model.id
            }
            value="track_select"
            data_testid="track_select"
          >
            <Icon fontSize="small">line_style</Icon>
          </ToggleButton>
        </div>
      )
    }),
  )

  function CircularView(props) {
    const { classes, model } = props

    return (
      <div className={classes.root}>
        <div
          className={classes.scroller}
          style={{
            width: `${model.width}px`,
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

        <ResizeHandleHorizontal
          onVerticalDrag={model.resizeHeight}
          objectId={model.id}
          style={{
            height: dragHandleHeight,
            position: 'absolute',
            bottom: 0,
            left: 0,
          }}
        />
      </div>
    )
  }
  CircularView.propTypes = {
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return withStyles(styles)(observer(CircularView))
}
