import { getTickDisplayStr, measureText, stripAlpha } from '@jbrowse/core/util'
import { SvgClipRect } from '@jbrowse/core/util/SvgExport'
import { useTheme } from '@mui/material'

import { labelFitsInBlock, makeBlockTicks, showRefNameLabels } from '../util.ts'
import SVGRegionSeparators from './SVGRegionSeparators.tsx'

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
  const c = stripAlpha(theme.palette.text.secondary)
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
          stroke={c}
        />
      ))}
      {!hideText
        ? ticks
            .filter(({ type }) => type === 'major')
            .map(({ base, x }) => {
              const label = getTickDisplayStr(base + 1, bpPerPx)
              const labelWidth = measureText(label, 11) + 4
              return labelFitsInBlock(x - 3, labelWidth, widthPx) ? (
                <text
                  key={`label-${base}`}
                  x={x - 3}
                  y={7 + 11}
                  fontSize={11}
                  fill={c}
                >
                  {label}
                </text>
              ) : null
            })
        : null}
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
  const theme = useTheme()
  const c = stripAlpha(theme.palette.text.primary)
  const showRefName = showRefNameLabels(contentBlocks, block => block.refName)
  return (
    <>
      <SVGRegionSeparators model={model} height={30} />
      {contentBlocks.map((block, i) => {
        const { start, end, key, reversed, offsetPx, refName, widthPx } = block
        const offset = offsetPx - viewOffsetPx
        return (
          <g key={key} transform={`translate(${offset} 0)`}>
            <SvgClipRect id={`clip-${key}`} width={widthPx} height={100}>
              {showRefName[i] ? (
                <text x={4} y={fontSize} fontSize={fontSize} fill={c}>
                  {refName}
                </text>
              ) : null}
              {/* very narrow regions (e.g. whole-genome view of small
              chromosomes) crowd ticks under the refName label, so skip them */}
              {widthPx >= 150 ? (
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
              ) : null}
            </SvgClipRect>
          </g>
        )
      })}
    </>
  )
}
