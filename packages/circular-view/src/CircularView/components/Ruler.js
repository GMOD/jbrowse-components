export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const { polarToCartesian, radToDeg, assembleLocString } = jbrequire(
    '@gmod/jbrowse-core/util',
  )

  const useStyles = makeStyles({
    rulerLabel: {
      fontSize: '0.8rem',
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      fontWeight: 500,
      lineHeight: 1.6,
      letterSpacing: '0.0075em',
    },
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

  const ElisionRulerArc = observer(({ model, slice }) => {
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
  })

  const RulerLabel = observer(
    ({ view, text, maxWidthPx, radians, radiusPx, title }) => {
      const classes = useStyles()
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
            transform={`translate(${textXY}) rotate(${radToDeg(radians) + 90})`}
          >
            {text}
            <title>{title || text}</title>
          </text>
        )
      }
      if (maxWidthPx > 4) {
        // text is rotated perpendicular to the ruler arc
        const overallRotation = radToDeg(
          radians + view.offsetRadians - Math.PI / 2,
        )
        if (overallRotation >= 180) {
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
            transform={`translate(${textXY}) rotate(${
              radToDeg(radians) + 180
            })`}
          >
            {text}
            <title>{title || text}</title>
          </text>
        )
      }

      // if you get here there is no room for the text at all
      return null
    },
  )

  const RegionRulerArc = observer(({ model, slice }) => {
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
  })

  const Ruler = observer(function Ruler({ model, slice }) {
    if (slice.region.elided) {
      return (
        <ElisionRulerArc
          key={assembleLocString(slice.region.regions[0])}
          model={model}
          slice={slice}
        />
      )
    }
    return (
      <RegionRulerArc
        key={assembleLocString(slice.region)}
        model={model}
        slice={slice}
      />
    )
  })

  return Ruler
}
