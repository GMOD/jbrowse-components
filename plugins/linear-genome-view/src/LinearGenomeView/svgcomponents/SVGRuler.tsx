import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import {
  REF_NAME_LABEL_FONT_SIZE,
  getScalebarRefNameLabels,
  labelFitsInBlock,
  refNameLabelFitsInView,
  tickLabelWidth,
} from '../util.ts'
import SVGRegionSeparators from './SVGRegionSeparators.tsx'
import {
  RULER_MAJOR_TICK,
  RULER_MINOR_TICK,
  RULER_TICK_FONT_SIZE,
  getRulerLayout,
  gridlineTickXs,
  refNameLabelBaselineY,
  refNameLabelBoxHeight,
  vlinePath,
} from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ScalebarRefNameLabel } from '../util.ts'

type LGV = LinearGenomeViewModel

// Tick marks and their coordinate labels, read from the same model getters the
// on-screen Gridlines/ScalebarCoordinateLabels use (gridlineTicks /
// scalebarLabels), so tick pitch, label text and label placement can't drift
// from the screen. Both are computed in the staticBlocks frame, which overhangs
// the viewport, so shift by the view's `staticBlocksTranslateX` and let the
// caller's clip trim the overhang.
function Ruler({
  model,
  tickTopY,
  numbersBaselineY,
}: {
  model: LGV
  // Top y of the tick marks; they hang downward toward the tracks.
  tickTopY: number
  // Baseline y for the tick-number text, positioned above the tick marks.
  numbersBaselineY: number
}) {
  const theme = useTheme()
  const color = stripAlpha(theme.palette.text.secondary)
  const { scalebarLabels, width } = model
  const { dx, major, minor } = gridlineTickXs(model)
  // major and minor marks share a stroke and differ only in length, so both
  // collapse into a single path
  const ticks =
    vlinePath(major, tickTopY, tickTopY + RULER_MAJOR_TICK) +
    vlinePath(minor, tickTopY, tickTopY + RULER_MINOR_TICK)
  return (
    <>
      <path d={ticks} strokeWidth={1} stroke={color} fill="none" />
      {/* Centered on the tick (textAnchor middle), matching the on-screen
      scalebar's zero-width flex tick. scalebarLabels only drops labels that
      overrun their *region*, so one at the view's edge survives it and would
      export half-cut by the clip below — on screen that reads as a label
      scrolled partly out of frame, but a static image has no frame to scroll,
      so drop it instead. */}
      {scalebarLabels
        .filter(({ x, label }) => {
          const w = tickLabelWidth(label)
          return labelFitsInBlock(dx + x - w / 2, w, width)
        })
        .map(({ x, label, key }) => (
          <text
            key={key}
            x={dx + x}
            y={numbersBaselineY}
            textAnchor="middle"
            fontSize={RULER_TICK_FONT_SIZE}
            fill={color}
          >
            {label}
          </text>
        ))}
    </>
  )
}

// Chromosome/refName labels along the ruler. Reuses the on-screen scalebar's
// sticky-label logic (getScalebarRefNameLabels) so the exported name stays
// pinned to the viewport's left edge when a region has scrolled off — otherwise
// the name renders off-canvas whenever you export a view zoomed into a
// chromosome interior. No assembly-name prefix here (unlike the on-screen
// scalebar): the SVG export already draws a standalone assembly-name label
// above the ruler, so folding it into this one too is redundant.
//
// `orientation` is not redundant, and this is the surface that needed it most.
// A stacked export gives each row SVGRowHeader — assembly name, ruler, refName
// labels — and no locstring, so a flipped row used to leave the numbers
// counting down as the only evidence it was flipped. On screen the search box
// says so; a figure has no search box.
function SVGRefNameLabels({ model }: { model: LGV }) {
  const theme = useTheme()
  const fill = stripAlpha(theme.palette.text.primary)
  const { labels, caption } = getScalebarRefNameLabels({
    blocks: model.staticBlocks.blocks,
    offsetPx: model.offsetPx,
    prefix: undefined,
    orientation: model.displayedRegionsOrientation,
  })
  return (
    <>
      {/* With no prefix asked for, the caption is here only to say the row is
      flipped — and it is the whole reason orientation reaches this component.
      The labels are already inset clear of it. */}
      {caption === undefined ? null : (
        <text
          x={0}
          y={refNameLabelBaselineY}
          fontSize={REF_NAME_LABEL_FONT_SIZE}
          fontWeight="bold"
          fill={fill}
        >
          {caption}
        </text>
      )}
      {/* a label is fitted to its run of regions, which usually runs past the
      right edge of the view, so drop the ones SVGRuler's clip would cut — as
      the tick numbers at that same edge are dropped rather than half-drawn */}
      {labels
        .filter(label => refNameLabelFitsInView(label, model.width))
        .map(label => (
          <SVGRefNameLabel
            key={label.key}
            label={label}
            fill={fill}
            clipId={`reflabel-${svgNodeId(model)}-${label.key}`}
          />
        ))}
    </>
  )
}

// One refName label, clipped to the pixels left before its run of regions ends
// so a long name can't run past what it names — the vector counterpart of the
// on-screen label's maxWidth + overflow:clip. The clip rect spans the whole
// label box from its left edge, paddingLeft included, which is the box-sizing
// the on-screen span states for the same reason.
function SVGRefNameLabel({
  label,
  fill,
  clipId,
}: {
  label: ScalebarRefNameLabel
  fill: string
  clipId: string
}) {
  const { transform, maxWidth, paddingLeft, text } = label
  return (
    <g transform={`translate(${transform} 0)`}>
      <SvgClipRect id={clipId} width={maxWidth} height={refNameLabelBoxHeight}>
        <text
          x={paddingLeft}
          y={refNameLabelBaselineY}
          fontSize={REF_NAME_LABEL_FONT_SIZE}
          fontWeight="bold"
          fill={fill}
        >
          {text}
        </text>
      </SvgClipRect>
    </g>
  )
}

export default function SVGRuler({
  model,
  rulerHeight,
}: {
  model: LGV
  // Total vertical budget for this ruler (refName label + tick numbers + tick
  // marks), matching the caller's own row-height math. The tick marks are
  // anchored to the bottom of this budget (minus a small margin) so they can
  // never spill into the content that starts right below; the tick numbers sit
  // just above the marks.
  rulerHeight: number
}) {
  const { tickTopY, numbersBaselineY } = getRulerLayout(rulerHeight)
  return (
    // the tick and block frames overhang the viewport on both sides; clip so
    // ticks, tick numbers, refName labels and the region-separator bar at the
    // last region's right edge can't bleed into the export margin (on screen
    // the scalebar's overflow:hidden does this)
    <SvgClipRect
      id={`ruler-clip-${svgNodeId(model)}`}
      width={model.width}
      height={rulerHeight}
    >
      <SVGRegionSeparators model={model} height={rulerHeight} />
      <Ruler
        model={model}
        tickTopY={tickTopY}
        numbersBaselineY={numbersBaselineY}
      />
      <SVGRefNameLabels model={model} />
    </SvgClipRect>
  )
}
