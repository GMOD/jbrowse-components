import {
  getSession,
  polarToCartesian,
  radToDeg,
  stripAlpha,
  toLocale,
} from '@jbrowse/core/util'
import { makeContrasting } from '@jbrowse/core/util/color'
import { useTheme } from '@mui/material/styles'
import { observer } from 'mobx-react'

import type { CircularViewModel } from '../model.ts'
import type {
  Slice,
  SliceElidedRegion,
  SliceNonElidedRegion,
} from '../slices.ts'

function arcPath(
  startXY: [number, number],
  endXY: [number, number],
  radiusPx: number,
  largeArc: '0' | '1',
) {
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
  return arcPath(startXY, endXY, radiusPx, largeArc)
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
  const { radiusPx } = model
  const { endRadians, startRadians } = slice
  const widthPx = (endRadians - startRadians) * radiusPx
  const largeArc = endRadians - startRadians > Math.PI ? '1' : '0'
  const centerRadians = (endRadians + startRadians) / 2
  const regionCount = `[${toLocale(region.regions.length)}]`
  return (
    <>
      <RulerLabel
        text={regionCount}
        offsetRadians={model.offsetRadians}
        maxWidthPx={widthPx}
        radians={centerRadians}
        radiusPx={radiusPx}
        title={`${regionCount} more regions`}
        color={theme.palette.text.primary}
      />
      <path
        d={arcPath(
          polarToCartesian(radiusPx + 1, startRadians),
          polarToCartesian(radiusPx + 1, endRadians),
          radiusPx + 1,
          largeArc,
        )}
        stroke={stripAlpha(theme.palette.text.secondary)}
        strokeWidth={2}
        strokeDasharray="2,2"
        fill="none"
      />
    </>
  )
})

const RulerLabel = observer(function RulerLabel({
  offsetRadians,
  text,
  maxWidthPx,
  radians,
  radiusPx,
  title = text,
  color,
}: {
  offsetRadians: number
  text: string
  maxWidthPx: number
  radiusPx: number
  radians: number
  title?: string
  color: string
}) {
  const textXY = polarToCartesian(radiusPx + 5, radians)
  const deg = radToDeg(radians)
  const parallel = text.length * 6.5 < maxWidthPx
  // the view rotates the whole figure by offsetRadians, so which half of the
  // screen a label lands on - and therefore which way it has to be flipped to
  // read right-side-up - depends on that rotation too. cos/sin of the on-screen
  // angle answer that without normalizing offsetRadians, which grows without
  // bound as the user rotates.
  const screenRadians = radians + offsetRadians
  const rightHalf = Math.cos(screenRadians) > 0
  const bottomHalf = Math.sin(screenRadians) > 0
  // parallel: text along the ruler arc, centered, flipped end-for-end on the
  // bottom half. perpendicular: text radiating outward from the arc, flipped on
  // the left half. Both flips keep the anchored text outside the arc.
  const textAnchor = parallel ? 'middle' : rightHalf ? 'start' : 'end'
  const rotation = parallel
    ? deg + (bottomHalf ? -90 : 90)
    : rightHalf
      ? deg
      : deg + 180
  return !text || maxWidthPx <= 4 ? null : (
    <text
      x={0}
      y={0}
      fontSize={13}
      fontWeight={500}
      letterSpacing="0.0075em"
      textAnchor={textAnchor}
      dominantBaseline="middle"
      transform={`translate(${textXY}) rotate(${rotation})`}
      fill={stripAlpha(color)}
    >
      {text}
      <title>{title}</title>
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
        offsetRadians={model.offsetRadians}
        maxWidthPx={widthPx}
        radians={centerRadians}
        radiusPx={radiusPx}
        color={color}
      />
      <path
        d={sliceArcPath(slice, radiusPx + 1, region.start, region.end)}
        stroke={stripAlpha(color)}
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

// the whole ideogram: shared by the on-screen view and the SVG export so the
// two can't drift
export const Rulers = observer(function Rulers({
  model,
}: {
  model: CircularViewModel
}) {
  return model.staticSlices.map(slice => (
    <Ruler key={slice.key} model={model} slice={slice} />
  ))
})

export default Ruler
