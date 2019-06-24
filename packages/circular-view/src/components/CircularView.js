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
      fontSize: '0.8rem',
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
            view={model}
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
            strokeDasharray="2,2"
            fill="none"
          />
        </React.Fragment>
      )
    }),
  )

  const RulerLabel = withStyles(styles)(
    observer(
      ({ classes, view, text, maxWidthPx, radians, radiusPx, title }) => {
        const textXY = polarToCartesian(radiusPx + 5, radians)
        if (!text) return null

        if (text.length * 6.5 < maxWidthPx) {
          // text is rotated parallel to the ruler arc
          return (
            <text
              x={0}
              y={0}
              className={classes.rulerLabel}
              textAnchor="middle"
              dominantBaseline="baseline"
              transform={`translate(${textXY}) rotate(${radToDeg(radians) +
                90})`}
            >
              {text}
              <title>{title || text}</title>
            </text>
          )
        }
        if (maxWidthPx > 12) {
          // text is rotated perpendicular to the ruler arc
          const overallRotation = radToDeg(radians + view.offsetRadians)
          if (overallRotation < 180) {
            return (
              <text
                x={0}
                y={0}
                className={classes.rulerLabel}
                textAnchor="start"
                dominantBaseline="middle"
                transform={`translate(${textXY}) rotate(${radToDeg(radians)})`}
              >
                {text}
                <title>{title || text}</title>
              </text>
            )
          }
          return (
            <text
              x={0}
              y={0}
              className={classes.rulerLabel}
              textAnchor="end"
              dominantBaseline="middle"
              transform={`translate(${textXY}) rotate(${radToDeg(radians) +
                180})`}
            >
              {text}
              <title>{title || text}</title>
            </text>
          )
        }

        return null
      },
    ),
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
            view={model}
            maxWidthPx={widthPx}
            radians={centerRadians}
            radiusPx={radiusPx}
          />
          {
            <path
              d={sliceArcPath(slice, radiusPx, region.start, region.end)}
              stroke="black"
              fill="none"
            >
              <title>{region.refName}</title>
            </path>
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

        <div className={classes.controls}>
          <button onClick={model.closeView}>X</button>
          <button onClick={model.zoomOutButton}>-</button>
          <button onClick={model.zoomInButton}>+</button>
          <button onClick={model.rotateCounterClockwiseButton}>↺</button>
          <button onClick={model.rotateClockwiseButton}>↻</button>
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
