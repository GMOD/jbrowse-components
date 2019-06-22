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
  const { polarToCartesian, radToDeg, assembleLocString } = jbrequire(
    '@gmod/jbrowse-core/util',
  )

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
    rulerLabel: {
      // fontSize: '11px',
      // fontWeight: 'bold',
      fontSize: '1rem',
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      fontWeight: 500,
      lineHeight: 1.6,
      letterSpacing: '0.0075em',
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

  function sliceArcPath(slice, radiusPx, startBase, endBase) {
    // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
    if (slice.flipped) [startBase, endBase] = [endBase, startBase]
    const startXY = slice.bpToXY(startBase, radiusPx)
    const endXY = slice.bpToXY(endBase, radiusPx)
    const largeArc =
      Math.abs(endBase - startBase) / slice.bpPerRadian > Math.PI ? '1' : '0'
    const sweepFlag = '1'
    return [
      'M',
      ...startXY,
      'A',
      radiusPx,
      radiusPx,
      '0',
      largeArc,
      sweepFlag,
      ...endXY,
    ].join(' ')
  }

  const ElisionRulerArc = withStyles(styles)(
    observer(({ classes, model, slice }) => {
      const { radiusPx } = model
      const { endRadians, startRadians, region } = slice
      const startXY = polarToCartesian(radiusPx, startRadians)
      const endXY = polarToCartesian(radiusPx, endRadians)
      const widthPx = (endRadians - startRadians) * radiusPx
      const largeArc = endRadians - startRadians > Math.PI ? '1' : '0'
      // TODO: draw the elision
      const centerRadians = (endRadians + startRadians) / 2
      const regionCountString = `[${Number(
        region.regions.length,
      ).toLocaleString()}]`
      return (
        <React.Fragment key={assembleLocString(region.regions[0])}>
          <RulerLabel
            text={regionCountString}
            maxWidthPx={widthPx}
            radians={centerRadians}
            radiusPx={radiusPx}
            title={`${Number(
              region.regions.length,
            ).toLocaleString()} more regions`}
          />
          <path
            d={[
              'M',
              ...startXY,
              'A',
              radiusPx,
              radiusPx,
              '0',
              largeArc,
              '1',
              ...endXY,
            ].join(' ')}
            stroke="gray"
            strokeDasharray="1,1"
            fill="none"
          />
        </React.Fragment>
      )
    }),
  )

  const RulerLabel = withStyles(styles)(
    observer(({ classes, text, maxWidthPx, radians, radiusPx, title }) => {
      const textXY = polarToCartesian(radiusPx + 5, radians)
      let visibleText = null
      if (text && text.length * 7 > maxWidthPx) {
        visibleText = '✹'
      } else {
        visibleText = text
      }
      return (
        <text
          x={0}
          y={0}
          className={classes.rulerLabel}
          textAnchor="middle"
          style={{}}
          dominantBaseline="baseline"
          transform={`translate(${textXY}) rotate(${radToDeg(radians) + 90})`}
        >
          {visibleText}
          <title>{title || text}</title>
        </text>
      )
    }),
  )

  const RegionRulerArc = withStyles(styles)(
    observer(({ classes, model, slice }) => {
      const { radiusPx } = model
      const { region, endRadians, startRadians } = slice
      const centerRadians = (endRadians + startRadians) / 2
      const widthPx = (endRadians - startRadians) * radiusPx

      // TODO: slice flipping
      return (
        <React.Fragment>
          <RulerLabel
            text={region.refName}
            maxWidthPx={widthPx}
            radians={centerRadians}
            radiusPx={radiusPx}
          />
          {
            <path
              d={sliceArcPath(slice, radiusPx, region.start, region.end)}
              stroke="black"
              fill="none"
            />
          }
        </React.Fragment>
      )
    }),
  )

  const Slices = withStyles(styles)(
    observer(({ classes, model }) => {
      return (
        <>
          {model.staticSlices.map(slice => {
            return slice.region.elided ? (
              <ElisionRulerArc
                key={assembleLocString(slice.region.regions[0])}
                model={model}
                slice={slice}
              />
            ) : (
              <RegionRulerArc
                key={assembleLocString(slice.region)}
                model={model}
                slice={slice}
              />
            )
          })}
        </>
      )
    }),
  )

  function CircularView(props) {
    const { classes, model } = props
    const [testingSvg, updateTestingSvg] = useState(undefined)
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
              transform: [`rotate(${model.offsetRadians}rad)`].join(' '),
              transition: 'transform 0.5s',
              transformOrigin: model.centerXY.map(x => `${x}px`).join(' '),
            }}
          >
            <svg
              style={{
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
                }) rotate(-90)`}
              >
                <Slices model={model} />
              </g>
            </svg>
          </div>
        </div>

        <div className={classes.controls}>
          <button onClick={model.closeView}>X</button>
          <button onClick={model.zoomOutButton}>-</button>
          <button onClick={model.zoomInButton}>+</button>
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
