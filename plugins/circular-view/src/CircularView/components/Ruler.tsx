import {
  getFillProps,
  getSession,
  getStrokeProps,
  polarToCartesian,
  radToDeg,
  toLocale,
} from '@jbrowse/core/util'
import { makeContrasting } from '@jbrowse/core/util/color'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material/styles'
import { observer } from 'mobx-react'

import type { CircularViewModel } from '../model.ts'
import type {
  Slice,
  SliceElidedRegion,
  SliceNonElidedRegion,
} from '../slices.ts'

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
  const startXY = slice.bpToXY(startBase, radiusPx)
  const endXY = slice.bpToXY(endBase, radiusPx)
  const largeArc =
    Math.abs(endBase - startBase) / slice.bpPerRadian > Math.PI ? '1' : '0'
  return [
    'M',
    ...startXY,
    'A',
    radiusPx,
    radiusPx,
    '0',
    largeArc,
    '1',
    ...endXY,
  ].join(' ')
}

const ElisionRulerArc = observer(function ElisionRulerArc({
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
  const centerRadians = (endRadians + startRadians) / 2
  const regionCount = `[${toLocale(region.regions.length)}]`
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

const RulerLabel = observer(function RulerLabel({
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
  if (!text || maxWidthPx <= 4) {
    return null
  }
  const textXY = polarToCartesian(radiusPx + 5, radians)
  const deg = radToDeg(radians)
  const parallel = text.length * 6.5 < maxWidthPx
  // parallel: text along the ruler arc, centered
  // perpendicular: text outside the arc, with anchor flipped on the bottom half
  // so labels stay readable rather than upside-down
  const upsideDown =
    !parallel && radToDeg(radians + view.offsetRadians - Math.PI / 2) >= 180
  const textAnchor = parallel ? 'middle' : upsideDown ? 'start' : 'end'
  const rotation = parallel ? deg + 90 : upsideDown ? deg : deg + 180
  return (
    <text
      x={0}
      y={0}
      className={classes.rulerLabel}
      textAnchor={textAnchor}
      dominantBaseline="middle"
      transform={`translate(${textXY}) rotate(${rotation})`}
      {...getFillProps(color)}
    >
      {text}
      <title>{title || text}</title>
    </text>
  )
})

const RegionRulerArc = observer(function RegionRulerArc({
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
  const refNameColor = assembly?.getRefNameColor(region.refName)
  let color: string
  try {
    color = refNameColor
      ? makeContrasting(refNameColor, theme.palette.background.paper)
      : theme.palette.text.primary
  } catch {
    color = theme.palette.text.primary
  }

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
        {...getStrokeProps(color)}
        strokeWidth={2}
        fill="none"
      />
    </>
  )
})

const Ruler = observer(function Ruler({
  model,
  slice,
}: {
  model: CircularViewModel
  slice: Slice
}) {
  return slice.region.elided ? (
    <ElisionRulerArc model={model} region={slice.region} slice={slice} />
  ) : (
    <RegionRulerArc region={slice.region} model={model} slice={slice} />
  )
})

export default Ruler
