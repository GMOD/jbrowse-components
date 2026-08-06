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

import {
  labelFitsAlongArc,
  labelFontSizePx,
  labelOffsetPx,
  sliceLabelText,
} from '../rulerLabels.ts'

import type { CircularViewModel } from '../model.ts'
import type {
  Slice,
  SliceElidedRegion,
  SliceNonElidedRegion,
} from '../slices.ts'

// the slice's own angular span as an SVG arc. A slice covers its region
// exactly, so this is equally the arc from its first base to its last
function sliceArcPath(slice: Slice, radiusPx: number) {
  const { startRadians, endRadians } = slice
  const arcTo = (radians: number, largeArc: '0' | '1') => [
    'A',
    radiusPx,
    radiusPx,
    '0',
    largeArc,
    '1',
    ...polarToCartesian(radiusPx, radians),
  ]
  const moveToStart = ['M', ...polarToCartesian(radiusPx, startRadians)]
  const spanRadians = endRadians - startRadians
  // A slice covering the whole circle ends exactly where it began, and SVG
  // renders an arc segment whose two endpoints coincide as nothing at all — a
  // lone chromosome with no inter-slice gap coming out of its span (spacingPx
  // 0) lost its entire ideogram ring, label still drawn. Sub-pixel short of a
  // full turn is the same thing once coordinates round. Two half-turns have
  // distinct endpoints and draw.
  return (
    (2 * Math.PI - spanRadians) * radiusPx < 1
      ? [
          ...moveToStart,
          ...arcTo(startRadians + Math.PI, '0'),
          ...arcTo(startRadians, '0'),
        ]
      : [
          ...moveToStart,
          ...arcTo(endRadians, spanRadians > Math.PI ? '1' : '0'),
        ]
  ).join(' ')
}

const RulerLabel = observer(function RulerLabel({
  offsetRadians,
  text,
  maxWidthPx,
  radians,
  radiusPx,
  title,
  color,
}: {
  offsetRadians: number
  text: string
  maxWidthPx: number
  radiusPx: number
  radians: number
  // hover text, only where it says something the label doesn't — an elision's
  // count expands to what it stands for, a refName is already itself
  title?: string
  color: string
}) {
  const textXY = polarToCartesian(radiusPx + labelOffsetPx, radians)
  const deg = radToDeg(radians)
  const parallel = labelFitsAlongArc(text, maxWidthPx)
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
      fontSize={labelFontSizePx}
      fontWeight={500}
      letterSpacing="0.0075em"
      textAnchor={textAnchor}
      dominantBaseline="middle"
      transform={`translate(${textXY}) rotate(${rotation})`}
      fill={stripAlpha(color)}
    >
      {text}
      {title ? <title>{title}</title> : null}
    </text>
  )
})

// the arc and its label, the two things every slice draws whether it stands for
// one region or a run of elided ones
const RulerArc = observer(function RulerArc({
  model,
  slice,
  text,
  title,
  labelColor,
  strokeColor,
  dashed,
}: {
  model: CircularViewModel
  slice: Slice
  text: string
  title?: string
  labelColor: string
  strokeColor: string
  dashed?: boolean
}) {
  const { radiusPx, offsetRadians } = model
  const { endRadians, startRadians } = slice
  return (
    <>
      <RulerLabel
        text={text}
        title={title}
        offsetRadians={offsetRadians}
        maxWidthPx={(endRadians - startRadians) * radiusPx}
        radians={(endRadians + startRadians) / 2}
        radiusPx={radiusPx}
        color={labelColor}
      />
      <path
        d={sliceArcPath(slice, radiusPx + 1)}
        stroke={stripAlpha(strokeColor)}
        strokeWidth={2}
        strokeDasharray={dashed ? '2,2' : undefined}
        fill="none"
      />
    </>
  )
})

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
  return (
    <RulerArc
      model={model}
      slice={slice}
      // the label is bracketed ("[24]") to read as a count rather than as a
      // refName; the hover text is a sentence, so it takes the bare number
      text={sliceLabelText(slice)}
      title={`${toLocale(region.regions.length)} regions too small to show`}
      labelColor={theme.palette.text.primary}
      strokeColor={theme.palette.text.secondary}
      dashed
    />
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
    <RulerArc
      model={model}
      slice={slice}
      text={sliceLabelText(slice)}
      labelColor={color}
      strokeColor={color}
    />
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
    <ElisionRulerArc region={slice.region} model={model} slice={slice} />
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
