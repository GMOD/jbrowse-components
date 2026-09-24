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
  assemblyArcGapPx,
  assemblyArcs,
  assemblyLabelFontSizePx,
  labelFontSizePx,
  labelGutterPx,
  labelIsDrawn,
  labelOffsetPx,
  labelsRunAlongArcs,
  sliceLabelText,
} from '../rulerLabels.ts'

import type { CircularViewModel } from '../model.ts'
import type { AssemblyArc } from '../rulerLabels.ts'
import type { Slice, SliceNonElidedRegion } from '../slices.ts'
import type { Theme } from '@mui/material/styles'

// the slice's own angular span as an SVG arc. A slice covers its region
// exactly, so this is equally the arc from its first base to its last
function sliceArcPath(
  slice: Pick<Slice, 'startRadians' | 'endRadians'>,
  radiusPx: number,
) {
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

// The view rotates the whole figure by offsetRadians, so which half of the
// screen a label lands on - and therefore which way it has to be flipped to
// read right-side-up - depends on that rotation too. cos/sin of the on-screen
// angle answer that without normalizing offsetRadians, which grows without
// bound as the user rotates.
//
// Along the arc: centered, flipped end-for-end on the bottom half. Radial:
// radiating outward from the arc, flipped on the left half. Both flips keep the
// anchored text outside the arc.
function labelPlacement(
  radians: number,
  offsetRadians: number,
  alongArc: boolean,
) {
  const deg = radToDeg(radians)
  const screenRadians = radians + offsetRadians
  const rightHalf = Math.cos(screenRadians) > 0
  const bottomHalf = Math.sin(screenRadians) > 0
  return alongArc
    ? { textAnchor: 'middle' as const, rotation: deg + (bottomHalf ? -90 : 90) }
    : rightHalf
      ? { textAnchor: 'start' as const, rotation: deg }
      : { textAnchor: 'end' as const, rotation: deg + 180 }
}

const RulerLabel = observer(function RulerLabel({
  offsetRadians,
  text,
  maxWidthPx,
  radians,
  radiusPx,
  alongArc,
  title,
  color,
}: {
  offsetRadians: number
  text: string
  maxWidthPx: number
  radiusPx: number
  radians: number
  alongArc: boolean
  // hover text, only where it says something the label doesn't — an elision's
  // count expands to what it stands for, a refName is already itself
  title?: string
  color: string
}) {
  if (!labelIsDrawn(text, maxWidthPx)) {
    return null
  }
  const textXY = polarToCartesian(radiusPx + labelOffsetPx, radians)
  const { textAnchor, rotation } = labelPlacement(
    radians,
    offsetRadians,
    alongArc,
  )
  return (
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

function regionColor(
  model: CircularViewModel,
  { assemblyName, refName }: SliceNonElidedRegion,
  theme: Theme,
) {
  const refNameColor = getSession(model)
    .assemblyManager.get(assemblyName)
    ?.getRefNameColor(refName)
  return refNameColor
    ? makeContrasting(refNameColor, theme.palette.background.paper)
    : theme.palette.text.primary
}

const Ruler = observer(function Ruler({
  model,
  slice,
  alongArc,
}: {
  model: CircularViewModel
  slice: Slice
  alongArc: boolean
}) {
  const theme = useTheme()
  const { radiusPx, offsetRadians } = model
  const { region, endRadians, startRadians } = slice
  const color = region.elided ? undefined : regionColor(model, region, theme)
  return (
    <>
      <RulerLabel
        text={sliceLabelText(slice)}
        title={
          region.elided
            ? `${toLocale(region.regions.length)} regions too small to show`
            : undefined
        }
        alongArc={alongArc}
        offsetRadians={offsetRadians}
        maxWidthPx={(endRadians - startRadians) * radiusPx}
        radians={(endRadians + startRadians) / 2}
        radiusPx={radiusPx}
        color={color ?? theme.palette.text.primary}
      />
      <path
        d={sliceArcPath(slice, radiusPx + 1)}
        stroke={stripAlpha(color ?? theme.palette.text.secondary)}
        strokeWidth={2}
        strokeDasharray={region.elided ? '2,2' : undefined}
        fill="none"
      />
    </>
  )
})

const AssemblyArcLabel = observer(function AssemblyArcLabel({
  model,
  arc,
  radiusPx,
}: {
  model: CircularViewModel
  arc: AssemblyArc
  radiusPx: number
}) {
  const theme = useTheme()
  const { assemblyName, startRadians, endRadians } = arc
  const radians = (startRadians + endRadians) / 2
  const labelRadiusPx =
    radiusPx + assemblyArcGapPx + assemblyLabelFontSizePx / 2
  const { textAnchor, rotation } = labelPlacement(
    radians,
    model.offsetRadians,
    true,
  )
  const name =
    getSession(model).assemblyManager.get(assemblyName)?.displayName ??
    assemblyName
  return (
    <>
      <path
        d={sliceArcPath(arc, radiusPx)}
        stroke={theme.palette.text.secondary}
        strokeWidth={1.5}
        fill="none"
      />
      <text
        x={0}
        y={0}
        fontSize={assemblyLabelFontSizePx}
        fontWeight={600}
        textAnchor={textAnchor}
        dominantBaseline="middle"
        transform={`translate(${polarToCartesian(labelRadiusPx, radians)}) rotate(${rotation})`}
        fill={theme.palette.text.primary}
      >
        {name}
      </text>
    </>
  )
})

// the whole ideogram: shared by the on-screen view and the SVG export so the
// two can't drift
export const Rulers = observer(function Rulers({
  model,
}: {
  model: CircularViewModel
}) {
  const { staticSlices, radiusPx } = model
  const alongArc = labelsRunAlongArcs(model)
  const assemblyRadiusPx = radiusPx + labelGutterPx(model) + assemblyArcGapPx
  return (
    <>
      {staticSlices.map(slice => (
        <Ruler
          key={slice.key}
          model={model}
          slice={slice}
          alongArc={alongArc}
        />
      ))}
      {assemblyArcs(staticSlices).map(arc => (
        <AssemblyArcLabel
          key={`${arc.assemblyName}-${arc.startRadians}`}
          model={model}
          arc={arc}
          radiusPx={assemblyRadiusPx}
        />
      ))}
    </>
  )
})

export default Ruler
