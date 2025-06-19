import { Fragment } from 'react'

import { bpSpanPx } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import type { Feature, Region } from '@jbrowse/core/util'

export default function Sequence({
  bpPerPx,
  region,
  feature,
  sequenceType,
  height,
  seq,
  y,
}: {
  seq: string
  bpPerPx: number
  sequenceType: string
  height: number
  region: Region
  feature: Feature
  y: number
}) {
  const theme = useTheme()
  const render = 1 / bpPerPx >= 12
  const s = feature.get('start')
  const e = feature.get('end')
  const [leftPx, rightPx] = bpSpanPx(s, e, region, bpPerPx)
  const reverse = region.reversed
  const len = e - s
  const w = Math.max((rightPx - leftPx) / len, 0.8)

  return (
    <>
      {seq.split('').map((letter, index) => {
        const color =
          sequenceType === 'dna'
            ? // @ts-expect-error
              theme.palette.bases[letter.toUpperCase()]
            : undefined
        const x = reverse ? rightPx - (index + 1) * w : leftPx + index * w
        return (
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          <Fragment key={`${letter}-${index}`}>
            <rect
              x={x}
              y={y}
              width={w}
              height={height}
              fill={color ? color.main : '#aaa'}
              stroke={render ? '#555' : 'none'}
            />
            {render ? (
              <text
                x={x + w / 2}
                y={y + height / 2}
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize={height - 2}
                fill={
                  color ? theme.palette.getContrastText(color.main) : 'black'
                }
              >
                {letter}
              </text>
            ) : null}
          </Fragment>
        )
      })}
    </>
  )
}
