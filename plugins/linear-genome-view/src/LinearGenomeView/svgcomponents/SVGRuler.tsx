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
}: {
  start: number
  end: number
  bpPerPx: number
  reversed?: boolean
  major?: boolean
  minor?: boolean
  hideText?: boolean
  widthPx: number
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
          y1={0}
          y2={type === 'major' ? 6 : 4}
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
                  y={7 + 11}
                  fontSize={11}
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
// chromosome interior.
function SVGRefNameLabels({
  model,
  fontSize,
}: {
  model: LGV
  fontSize: number
}) {
  const theme = useTheme()
  const fillProps = getFillProps(theme.palette.text.primary)
  const prefix = model.scalebarDisplayPrefix()
  const { labels, showPrefixFallback } = getScalebarRefNameLabels({
    blocks: model.staticBlocks.blocks,
    offsetPx: model.offsetPx,
    regionEndPx: model.scalebarRegionEndPx,
    prefix,
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
      {showPrefixFallback ? (
        <text
          x={0}
          y={fontSize}
          fontSize={REF_NAME_LABEL_FONT_SIZE}
          fontWeight="bold"
          {...fillProps}
        >
          {prefix}
        </text>
      ) : null}
    </>
  )
}

export default function SVGRuler({
  model,
  fontSize,
}: {
  model: LGV
  fontSize: number
}) {
  const {
    dynamicBlocks: { contentBlocks },
    offsetPx: viewOffsetPx,
    bpPerPx,
  } = model
  const renderRuler = contentBlocks.length < 5
  return (
    <>
      <SVGRegionSeparators model={model} height={30} />
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
            <g transform="translate(0 20)">
              <Ruler
                hideText={!renderRuler}
                start={start}
                end={end}
                bpPerPx={bpPerPx}
                reversed={reversed}
                widthPx={widthPx}
              />
            </g>
          </BlockClipGroup>
        ) : null
      })}
      <SVGRefNameLabels model={model} fontSize={fontSize} />
    </>
  )
}
