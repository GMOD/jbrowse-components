import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import {
  getFillProps,
  getStrokeProps,
  getTickDisplayStr,
} from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import BlockClipGroup from './BlockClipGroup.tsx'
import SVGRegionSeparators from './SVGRegionSeparators.tsx'
import {
  RULER_MAJOR_TICK,
  RULER_MINOR_TICK,
  RULER_TICK_FONT_SIZE,
  getRulerLayout,
} from './util.ts'
import {
  REF_NAME_LABEL_FONT_SIZE,
  getScalebarRefNameLabels,
  labelFitsInBlock,
  makeBlockTicks,
  tickLabelWidth,
} from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

function Ruler({
  start,
  end,
  bpPerPx,
  reversed = false,
  major = true,
  minor = true,
  hideText = false,
  widthPx,
  tickTopY,
  numbersBaselineY,
}: {
  start: number
  end: number
  bpPerPx: number
  reversed?: boolean
  major?: boolean
  minor?: boolean
  hideText?: boolean
  widthPx: number
  // Top y of the tick marks; they hang downward toward the tracks.
  tickTopY: number
  // Baseline y for the tick-number text, positioned above the tick marks.
  numbersBaselineY: number
}) {
  const theme = useTheme()
  const strokeProps = getStrokeProps(theme.palette.text.secondary)
  const fillProps = getFillProps(theme.palette.text.secondary)
  const ticks = makeBlockTicks({ start, end, reversed }, bpPerPx, major, minor)
  return (
    <>
      {ticks.map(({ base, type, x }) => (
        <line
          key={`tick-${base}`}
          x1={x}
          x2={x}
          y1={tickTopY}
          y2={tickTopY + (type === 'major' ? RULER_MAJOR_TICK : RULER_MINOR_TICK)}
          strokeWidth={1}
          {...strokeProps}
        />
      ))}
      {!hideText
        ? ticks
            .filter(({ type }) => type === 'major')
            .map(({ base, x }) => {
              const label = getTickDisplayStr(base + 1, bpPerPx)
              return labelFitsInBlock(x - 3, tickLabelWidth(label), widthPx) ? (
                <text
                  key={`label-${base}`}
                  x={x - 3}
                  y={numbersBaselineY}
                  fontSize={RULER_TICK_FONT_SIZE}
                  {...fillProps}
                >
                  {label}
                </text>
              ) : null
            })
        : null}
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
  const fillProps = getFillProps(theme.palette.text.primary)
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
            {...fillProps}
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
  const {
    dynamicBlocks: { contentBlocks },
    offsetPx: viewOffsetPx,
    bpPerPx,
  } = model
  const renderRuler = contentBlocks.length < 5
  const { tickTopY, numbersBaselineY } = getRulerLayout(rulerHeight)
  return (
    <>
      <SVGRegionSeparators model={model} height={rulerHeight} />
      {contentBlocks.map(block => {
        const { start, end, key, reversed, widthPx } = block
        // always draw the tick lines (even on narrow whole-genome chromosomes);
        // the numeric coordinate labels are what crowd a narrow region, and
        // those are already suppressed via hideText
        return widthPx >= 20 ? (
          <BlockClipGroup
            key={key}
            block={block}
            viewOffsetPx={viewOffsetPx}
            height={100}
            idPrefix={`clip-${model.id}`}
          >
            <Ruler
              hideText={!renderRuler}
              start={start}
              end={end}
              bpPerPx={bpPerPx}
              reversed={reversed}
              widthPx={widthPx}
              tickTopY={tickTopY}
              numbersBaselineY={numbersBaselineY}
            />
          </BlockClipGroup>
        ) : null
      })}
      <SVGRefNameLabels model={model} fontSize={fontSize} />
    </>
  )
}
