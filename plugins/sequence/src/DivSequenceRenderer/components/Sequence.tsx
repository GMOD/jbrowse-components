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

  let svg = ''
  for (let i = 0, l = seq.length; i < l; i++) {
    const letter = seq[i]!
    const color =
      sequenceType === 'dna'
        ? // @ts-expect-error
          theme.palette.bases[letter.toUpperCase()]
        : undefined
    const x = reverse ? rightPx - (i + 1) * w : leftPx + i * w
    const fill = color ? color.main : '#aaa'
    const stroke = render ? '#555' : 'none'

    svg += `<rect x="${x}" y="${y}" width="${w}" height="${height}" fill="${fill}" stroke="${stroke}"/>`

    if (render) {
      const textFill = color
        ? theme.palette.getContrastText(color.main)
        : 'black'
      svg += `<text x="${x + w / 2}" y="${y + height / 2}" dominant-baseline="middle" text-anchor="middle" font-size="${height - 2}" fill="${textFill}">${letter}</text>`
    }
  }

  return <g dangerouslySetInnerHTML={{ __html: svg }} />
}
