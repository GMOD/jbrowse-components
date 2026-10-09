import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import {
  getSession,
  polarToCartesian,
  radToDeg,
  stripAlpha,
  toLocale,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  assemblyArcGapPx,
  assemblyArcs,
  assemblyLabelFontSizePx,
  ideogramGapPx,
  ideogramThicknessPx,
  labelFontSizePx,
  labelGutterPx,
  labelIsDrawn,
  labelOffsetPx,
  labelsRunAlongArcs,
  middleTitle,
  sliceLabelText,
  tickFontSizePx,
  tickLabelGapPx,
  tickMajorPx,
  tickMinorPx,
} from '../rulerLabels.ts'
import { rulerTicks } from '../rulerTicks.ts'
import { bpToRadians } from '../slices.ts'

import type { CircularViewModel } from '../model.ts'
import type { AssemblyArc } from '../rulerLabels.ts'
import type { Slice, SliceNonElidedRegion } from '../slices.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

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

// the annulus between two radii over the slice's span, outer arc first
function sliceBandPath(
  slice: Pick<Slice, 'startRadians' | 'endRadians'>,
  innerPx: number,
  outerPx: number,
): string {
  const { startRadians, endRadians } = slice
  if ((2 * Math.PI - (endRadians - startRadians)) * outerPx < 1) {
    const half = startRadians + Math.PI
    return `${sliceBandPath({ startRadians, endRadians: half }, innerPx, outerPx)} ${sliceBandPath({ startRadians: half, endRadians: startRadians + 2 * Math.PI }, innerPx, outerPx)}`
  }
  const largeArc = endRadians - startRadians > Math.PI ? '1' : '0'
  return [
    'M',
    ...polarToCartesian(outerPx, startRadians),
    'A',
    outerPx,
    outerPx,
    '0',
    largeArc,
    '1',
    ...polarToCartesian(outerPx, endRadians),
    'L',
    ...polarToCartesian(innerPx, endRadians),
    'A',
    innerPx,
    innerPx,
    '0',
    largeArc,
    '0',
    ...polarToCartesian(innerPx, startRadians),
    'Z',
  ].join(' ')
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

const middleTitleFontSizePx = 16

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
  palette: JBrowsePalette,
) {
  return (
    getSession(model)
      .assemblyManager.get(assemblyName)
      ?.getRefNameColor(refName) ?? palette.text.secondary
  )
}

// A slice's stretch of the ideogram: its chromosome's color, or on a genome
// a ribbon track paints, a neutral band under the colors of the first
// genome's chromosomes that align to it
const IdeogramBand = observer(function IdeogramBand({
  model,
  slice,
  region,
  innerPx,
  outerPx,
}: {
  model: CircularViewModel
  slice: Slice
  region: SliceNonElidedRegion
  innerPx: number
  outerPx: number
}) {
  const palette = usePalette()
  const band = sliceBandPath(slice, innerPx, outerPx)
  const runs =
    region.assemblyName === model.paintedAssemblyName
      ? (model.ideogramPaint.get(slice.key) ?? [])
      : undefined
  const outline = {
    stroke: palette.text.primary,
    strokeOpacity: 0.6,
    strokeWidth: 0.5,
  }
  return runs ? (
    <>
      <path d={band} fill={palette.divider} />
      {runs.map(run => {
        const a = bpToRadians(slice, run.start)
        const b = bpToRadians(slice, run.end)
        return (
          <path
            key={run.start}
            d={sliceBandPath(
              { startRadians: Math.min(a, b), endRadians: Math.max(a, b) },
              innerPx,
              outerPx,
            )}
            fill={stripAlpha(run.color)}
          />
        )
      })}
      <path d={band} fill="none" {...outline} />
    </>
  ) : (
    <path
      d={band}
      fill={stripAlpha(regionColor(model, region, palette))}
      {...outline}
    />
  )
})

// a slice's base-pair ticks, standing outward from the ideogram's outer edge,
// each major one labelled along the arc past its tip
const RulerTicks = observer(function RulerTicks({
  model,
  slice,
  basePx,
  seam,
}: {
  model: CircularViewModel
  slice: Slice
  basePx: number
  seam: boolean
}) {
  const palette = usePalette()
  const { radiusPx, offsetRadians } = model
  const color = palette.text.secondary
  return (
    <g stroke={color} data-testid="ruler-ticks">
      {rulerTicks(slice, radiusPx, seam).map(({ base, radians, label }) => {
        const tipPx = basePx + (label ? tickMajorPx : tickMinorPx)
        const [x1, y1] = polarToCartesian(basePx, radians)
        const [x2, y2] = polarToCartesian(tipPx, radians)
        const labelXY = polarToCartesian(
          tipPx + tickLabelGapPx + tickFontSizePx / 2,
          radians,
        )
        const { textAnchor, rotation } = labelPlacement(
          radians,
          offsetRadians,
          true,
        )
        return (
          <g key={base}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            {label === undefined ? null : (
              <text
                fontSize={tickFontSizePx}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                transform={`translate(${labelXY}) rotate(${rotation})`}
                fill={color}
                stroke="none"
              >
                {label}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
})

const Ruler = observer(function Ruler({
  model,
  slice,
  alongArc,
}: {
  model: CircularViewModel
  slice: Slice
  alongArc: boolean
}) {
  const palette = usePalette()
  const { radiusPx, offsetRadians } = model
  const { region, endRadians, startRadians } = slice
  const innerPx = radiusPx + ideogramGapPx
  const outerPx = innerPx + ideogramThicknessPx
  return (
    <>
      <RulerLabel
        text={sliceLabelText(slice, model.staticSlices)}
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
        color={palette.text.primary}
      />
      {region.elided ? (
        <path
          d={sliceArcPath(slice, (innerPx + outerPx) / 2)}
          stroke={palette.text.secondary}
          strokeWidth={2}
          strokeDasharray="2,2"
          fill="none"
        />
      ) : (
        <>
          <IdeogramBand
            model={model}
            slice={slice}
            region={region}
            innerPx={innerPx}
            outerPx={outerPx}
          />
          <RulerTicks
            model={model}
            slice={slice}
            basePx={outerPx}
            seam={middleTitle(model.staticSlices) !== undefined}
          />
        </>
      )}
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
  const palette = usePalette()
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
        stroke={palette.divider}
        strokeWidth={1}
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
        fill={palette.text.primary}
      >
        {name}
      </text>
    </>
  )
})

// a circle of one contig titled in its middle, kept level as the figure turns
const MiddleTitle = observer(function MiddleTitle({
  model,
}: {
  model: CircularViewModel
}) {
  const palette = usePalette()
  const region = middleTitle(model.staticSlices)
  return region ? (
    <g
      data-testid="circular-middle-title"
      transform={`rotate(${-radToDeg(model.offsetRadians)})`}
      textAnchor="middle"
    >
      <text
        y={-4}
        fontSize={middleTitleFontSizePx}
        fontWeight={600}
        fill={palette.text.primary}
      >
        {region.refName}
      </text>
      <text
        y={middleTitleFontSizePx}
        fontSize={labelFontSizePx}
        fill={palette.text.secondary}
      >
        {toLocale(region.end - region.start)} bp
      </text>
    </g>
  ) : null
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
      <MiddleTitle model={model} />
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
