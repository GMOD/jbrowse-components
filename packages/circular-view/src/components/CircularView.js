import exampleSvg from '../../test_data/circos_example_content.txt'

const svgFetch = fetch(exampleSvg).then(result => result.text())

const dragHandleHeight = 3

export default pluginManager => {
  const { jbrequire } = pluginManager
  const { PropTypes } = jbrequire('mobx-react')
  const { observer } = jbrequire('mobx-react-lite')
  const ReactPropTypes = jbrequire('prop-types')
  const React = jbrequire('react')
  const { useState, useEffect } = React
  const { withStyles } = jbrequire('@material-ui/core')
  const ResizeHandleHorizontal = jbrequire(
    '@gmod/jbrowse-core/components/ResizeHandleHorizontal',
  )
  const { polarToCartesian, radToDeg } = jbrequire('@gmod/jbrowse-core/util')

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
    controls: {
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      position: 'absolute',
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

  // const RulerArc = withStyles(styles)(
  //   observer(({ classes, block }) => {

  //   }))

  const Slices = withStyles(styles)(
    observer(({ classes, model }) => {
      // <svg
      //           style={{
      //             // transform: `translate(${originOffset.x -
      //             //   canvas.originX}px,${originOffset.y -
      //             //   canvas.originY}px) rotate(${canvas.rotation}rad)`,
      //             // transform: `translate(${-canvas.originX}px,${-canvas.originY}px) rotate(${
      //             //   canvas.rotation
      //             // }rad)`,
      //             // background: 'rgba(0,0,0,0.1)',
      //             transformOrigin: '0 0',
      //             position: 'absolute',
      //             left: model.centerXY[0],
      //             top: model.centerXY[1],
      //           }}
      //           key={region.refName}
      //           className={classes.sliceRoot}
      //           width={`${canvas.widthPx}px`}
      //           height={`${canvas.heightPx}px`}
      //           version="1.1"
      //         ></svg>
      return (
        <>
          {model.staticSlices.map(({ region, canvas, spacingOffset }) => {
            const endRad = (region.end - region.start) / model.bpPerRadian
            const [endX, endY] = polarToCartesian(model.radiusPx, endRad)
            return (
              <g
                key={region.refName}
                transform={`translate(${spacingOffset.x}, ${
                  spacingOffset.y
                }) rotate(${radToDeg(canvas.rotation)})`}
              >
                <line x1={0} y1={0} x2={model.radiusPx} y2={0} stroke="blue" />
                <text x={0} y={0} dominantBaseline="hanging">
                  {region.refName}
                </text>
                <line x1={0} y1={0} x2={endX} y2={endY} stroke="red" />
              </g>
            )
          })}
        </>
      )
    }),
  )

  function CircularView(props) {
    const { classes, model } = props
    const [testingSvg, updateTestingSvg] = useState(undefined)
    // const rootModel = getRoot(model)
    // const { id } = model
    useEffect(() => {
      if (!testingSvg) {
        svgFetch.then(text => {
          updateTestingSvg(text)
        })
      }
    })

    return (
      <div className={classes.root}>
        <div
          className={classes.scroller}
          style={{
            width: `${model.width}px`,
            height: `${model.height}px`,
          }}
        >
          <div
            className={classes.rotator}
            style={{
              transform: [
                `rotate(${(model.offsetRadians * 180) / Math.PI}deg)`,
              ].join(' '),
              transition: 'transform 0.5s',
              // transformOrigin: '500px 500px',
            }}
          >
            <svg
              style={{
                // transform: `translate(${originOffset.x -
                //   canvas.originX}px,${originOffset.y -
                //   canvas.originY}px) rotate(${canvas.rotation}rad)`,
                // transform: `translate(${-canvas.originX}px,${-canvas.originY}px) rotate(${
                //   canvas.rotation
                // }rad)`,
                // background: 'rgba(0,0,0,0.1)',
                transformOrigin: '0 0',
                position: 'absolute',
                left: 0,
                top: 0,
              }}
              className={classes.sliceRoot}
              width={`${model.figureWidth}px`}
              height={`${model.figureHeight}px`}
              version="1.1"
            >
              <g
                transform={`translate(${model.centerXY[0]}, ${
                  model.centerXY[1]
                })`}
              >
                <Slices model={model} />
              </g>
            </svg>
          </div>
        </div>

        <div className={classes.controls}>
          <button onClick={model.closeView}>X</button>
          <button>-</button>
          <button>+</button>
          <button onClick={model.rotateClockwiseButton}>↻</button>
          <button onClick={model.rotateCounterClockwiseButton}>↺</button>
        </div>

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
