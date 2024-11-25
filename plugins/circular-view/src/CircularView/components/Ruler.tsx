import React from 'react'
import {
  getSession,
  polarToCartesian,
  radToDeg,
  assembleLocString,
  getStrokeProps,
  getFillProps,
} from '@jbrowse/core/util'
import { makeContrasting } from '@jbrowse/core/util/color'
import { useTheme } from '@mui/material/styles'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { CircularViewModel } from '../models/model'
import type {
  Slice,
  SliceElidedRegion,
  SliceNonElidedRegion,
} from '../models/slices'

const useStyles = makeStyles()({
  rulerLabel: {
    fontSize: '0.8rem',
    fontWeight: 500,
    lineHeight: 1.6,
    letterSpacing: '0.0075em',
  },
})

function sliceArcPath(
  slice: Slice,
  radiusPx: number,
  startBase: number,
  endBase: number,
) {
  // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
  if (slice.flipped) {
    ;[startBase, endBase] = [endBase, startBase]
  }
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

const ElisionRulerArc = observer(function ({
  model,
  slice,
  region,
}: {
  model: CircularViewModel
  slice: Slice
  region: SliceElidedRegion
}) {
  const theme = useTheme()
  const { radiusPx: modelRadiusPx } = model
  const radiusPx = modelRadiusPx + 1
  const { endRadians, startRadians } = slice
  const startXY = polarToCartesian(radiusPx, startRadians)
  const endXY = polarToCartesian(radiusPx, endRadians)
  const widthPx = (endRadians - startRadians) * radiusPx
  const largeArc = endRadians - startRadians > Math.PI ? '1' : '0'
  // TODO: draw the elision
  const centerRadians = (endRadians + startRadians) / 2
  const regionCount = `[${Number(region.regions.length).toLocaleString()}]`
  return (
    <>
      <RulerLabel
        text={regionCount}
        view={model}
        maxWidthPx={widthPx}
        radians={centerRadians}
        radiusPx={radiusPx}
        title={`${regionCount} more regions`}
        color={theme.palette.text.primary}
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
        {...getStrokeProps(theme.palette.text.secondary)}
        strokeWidth={2}
        strokeDasharray="2,2"
        fill="none"
      />
    </>
  )
})

const RulerLabel = observer(function ({
  view,
  text,
  maxWidthPx,
  radians,
  radiusPx,
  title,
  color,
}: {
  view: CircularViewModel
  text: string
  maxWidthPx: number
  radiusPx: number
  radians: number
  title?: string
  color: string
}) {
  const { classes } = useStyles()
  const textXY = polarToCartesian(radiusPx + 5, radians)
  if (!text) {
    return null
  }

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
        {...getFillProps(color)}
      >
        {text}
        <title>{title || text}</title>
      </text>
    )
  }
  if (maxWidthPx > 4) {
    // text is rotated perpendicular to the ruler arc
    const overallRotation = radToDeg(radians + view.offsetRadians - Math.PI / 2)
    if (overallRotation >= 180) {
      return (
        <text
          x={0}
          y={0}
          className={classes.rulerLabel}
          textAnchor="start"
          dominantBaseline="middle"
          transform={`translate(${textXY}) rotate(${radToDeg(radians)})`}
          fill={color}
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
        transform={`translate(${textXY}) rotate(${radToDeg(radians) + 180})`}
        fill={color}
      >
        {text}
        <title>{title || text}</title>
      </text>
    )
  }

  // if you get here there is no room for the text at all
  return null
})

const RegionRulerArc = observer(function ({
  model,
  slice,
  region,
}: {
  model: CircularViewModel
  slice: Slice
  region: SliceNonElidedRegion
}) {
  const theme = useTheme()
  const { radiusPx } = model
  const { endRadians, startRadians } = slice
  const centerRadians = (endRadians + startRadians) / 2
  const widthPx = (endRadians - startRadians) * radiusPx
  const session = getSession(model)
  const assembly = session.assemblyManager.get(region.assemblyName)
  let color = assembly ? assembly.getRefNameColor(region.refName) : undefined
  if (color) {
    try {
      color = makeContrasting(color, theme.palette.background.paper)
    } catch (error) {
      color = theme.palette.text.primary
    }
  } else {
    color = theme.palette.text.primary
  }

  // TODO: slice flipping
  return (
    <>
      <RulerLabel
        text={region.refName}
        view={model}
        maxWidthPx={widthPx}
        radians={centerRadians}
        radiusPx={radiusPx}
        color={color}
      />
      <path
        d={sliceArcPath(slice, radiusPx + 1, region.start, region.end)}
        stroke={color}
        strokeWidth={2}
        fill="none"
      />
    </>
  )
})

const Ruler = observer(function ({
  model,
  slice,
}: {
  model: CircularViewModel
  slice: Slice
}) {
  return slice.region.elided ? (
    <ElisionRulerArc
      key={assembleLocString(slice.region.regions[0]!)}
      model={model}
      region={slice.region}
      slice={slice}
    />
  ) : (
    <RegionRulerArc
      key={assembleLocString(slice.region)}
      region={slice.region}
      model={model}
      slice={slice}
    />
  )
})

export default Ruler
