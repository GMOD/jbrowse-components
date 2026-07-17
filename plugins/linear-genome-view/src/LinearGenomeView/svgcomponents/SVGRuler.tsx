import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import SVGRegionSeparators from './SVGRegionSeparators.tsx'
import {
  RULER_MAJOR_TICK,
  RULER_MINOR_TICK,
  RULER_TICK_FONT_SIZE,
  getRulerLayout,
  staticBlocksDx,
  vlinePath,
} from './util.ts'
import {
  REF_NAME_LABEL_FONT_SIZE,
  getScalebarRefNameLabels,
  labelFitsInBlock,
  tickLabelWidth,
} from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

// Tick marks and their coordinate labels, read from the same model getters the
// on-screen Gridlines/ScalebarCoordinateLabels use (gridlineTicks /
// scalebarLabels), so tick pitch, label text and label placement can't drift
// from the screen. Both are computed in the staticBlocks frame, which overhangs
// the viewport, so shift by staticBlocksDx and let the caller's clip trim the
// overhang.
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
  const { gridlineTicks, scalebarLabels, width } = model
  const dx = staticBlocksDx(model)
  const xs = (wantMajor: boolean) =>
    gridlineTicks.filter(t => t.major === wantMajor).map(t => dx + t.x)
  // major and minor marks share a stroke and differ only in length, so both
  // collapse into a single path
  const ticks =
    vlinePath(xs(true), tickTopY, tickTopY + RULER_MAJOR_TICK) +
    vlinePath(xs(false), tickTopY, tickTopY + RULER_MINOR_TICK)
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
function SVGRefNameLabels({
  model,
  fontSize,
}: {
  model: LGV
  fontSize: number
}) {
  const theme = useTheme()
  const fill = stripAlpha(theme.palette.text.primary)
  const { labels } = getScalebarRefNameLabels({
    blocks: model.staticBlocks.blocks,
    offsetPx: model.offsetPx,
    regionEndPx: model.scalebarRegionEndPx,
    prefix: undefined,
  })
  return (
    <>
      {labels.map(({ key, transform, maxWidth, paddingLeft, text }) => {
        const label = (
          <text
            x={paddingLeft}
            y={fontSize}
            fontSize={REF_NAME_LABEL_FONT_SIZE}
            fontWeight="bold"
            fill={fill}
          >
            {text}
          </text>
        )
        return (
          <g key={key} transform={`translate(${transform} 0)`}>
            {maxWidth === undefined ? (
              label
            ) : (
              <SvgClipRect
                id={`reflabel-${model.id}-${key}`}
                width={Math.max(maxWidth, 0)}
                height={fontSize + 2}
              >
                {label}
              </SvgClipRect>
            )}
          </g>
        )
      })}
    </>
  )
}

export default function SVGRuler({
  model,
  fontSize,
  rulerHeight,
}: {
  model: LGV
  fontSize: number
  // Total vertical budget for this ruler (refName label + tick numbers + tick
  // marks), matching the caller's own row-height math. The tick marks are
  // anchored to the bottom of this budget (minus a small margin) so they can
  // never spill into the content that starts right below; the tick numbers sit
  // just above the marks.
  rulerHeight: number
}) {
  const { tickTopY, numbersBaselineY } = getRulerLayout(rulerHeight)
  return (
    <>
      <SVGRegionSeparators model={model} height={rulerHeight} />
      {/* the tick frame overhangs the viewport on both sides; clip so ticks and
      labels can't bleed into the export margin */}
      <SvgClipRect
        id={`ruler-clip-${model.id}`}
        width={model.width}
        height={rulerHeight}
      >
        <Ruler
          model={model}
          tickTopY={tickTopY}
          numbersBaselineY={numbersBaselineY}
        />
      </SvgClipRect>
      <SVGRefNameLabels model={model} fontSize={fontSize} />
    </>
  )
}
