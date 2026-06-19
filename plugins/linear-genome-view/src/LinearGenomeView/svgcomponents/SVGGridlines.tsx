import { getStrokeProps } from '@jbrowse/core/util'
import { SvgClipRect } from '@jbrowse/core/util/SvgExport'
import { useTheme } from '@mui/material'

import { makeBlockTicks } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

export default function SVGGridlines({
  model,
  height,
}: {
  model: LGV
  height: number
}) {
  const {
    dynamicBlocks: { contentBlocks },
    offsetPx: viewOffsetPx,
    bpPerPx,
  } = model
  const theme = useTheme()
  // share the on-screen gridline colors; getStrokeProps splits the rgba alpha
  // into strokeOpacity so the exported SVG stays renderer-safe
  const minor = getStrokeProps(theme.palette.gridlineMinor)
  const major = getStrokeProps(theme.palette.gridlineMajor)

  return (
    <>
      {contentBlocks.map(block => {
        const { key, offsetPx, widthPx } = block
        const offset = offsetPx - viewOffsetPx
        const ticks = makeBlockTicks(block, bpPerPx)
        return (
          <g key={key} transform={`translate(${offset} 0)`}>
            <SvgClipRect
              id={`gridline-clip-${key}`}
              width={widthPx}
              height={height}
            >
              {ticks.map(({ base, type, x }) => (
                <line
                  key={`gridline-${base}`}
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={height}
                  strokeWidth={1}
                  {...(type === 'major' ? major : minor)}
                />
              ))}
            </SvgClipRect>
          </g>
        )
      })}
    </>
  )
}
