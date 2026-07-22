import { getFillProps } from '@jbrowse/core/util'
import { layoutBpToPx } from '@jbrowse/core/util/Base1DUtils'
import { observer } from 'mobx-react'

import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'

import type { Cytoband } from './util.ts'
import type { ViewLayout } from '@jbrowse/core/util/Base1DUtils'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

// rounded rect from https://stackoverflow.com/a/45889603/2129219
function rightRoundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  return `M${x},${y}h${width - radius}a${radius},${radius} 0 0 1 ${radius},${radius}v${height - 2 * radius}a${radius},${radius} 0 0 1 ${-radius},${radius}h${radius - width}z`
}

function leftRoundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  return `M${x + radius},${y}h${width - radius}v${height}h${radius - width}a${radius},${radius} 0 0 1 ${-radius},${-radius}v${2 * radius - height}a${radius},${radius} 0 0 1 ${radius},${-radius}z`
}

function triangleRight(x: number, y: number, width: number, height: number) {
  return [
    [x, y],
    [x + width, y + height / 2],
    [x, y + height],
  ].toString()
}

function triangleLeft(x: number, y: number, width: number, height: number) {
  return [
    [x, y + height / 2],
    [x + width, y],
    [x + width, y + height],
  ].toString()
}

const colorMap: Record<string, string> = {
  gneg: 'rgb(227,227,227)',
  gpos25: 'rgb(142,142,142)',
  gpos33: 'rgb(142,142,142)',
  gpos50: 'rgb(85,85,85)',
  gpos66: 'rgb(85,85,85)',
  gpos100: 'rgb(0,0,0)',
  gpos75: 'rgb(57,57,57)',
  gvar: 'rgb(0,0,0)',
  stalk: 'rgb(127,127,127)',
  acen: '#800',
}

// assemblies without Giemsa stains (e.g. dm6's numbered polytene divisions)
// arrive as 'n/a'; alternate two greys per numbered group so adjacent divisions
// stay distinguishable without painting a distracting colored block
function bandColors(cytobands: Cytoband[]) {
  let prevKey = ''
  let group = 0
  return cytobands.map(({ name, type }) => {
    if (type !== 'n/a') {
      return colorMap[type] ?? 'black'
    }
    const [, digits, letter] = name?.match(/^(\d+)([A-Za-z])/) ?? []
    const key = digits && letter ? digits + letter : ''
    if (key && key !== prevKey) {
      prevKey = key
      group++
    }
    return group % 2 ? 'rgb(120,120,120)' : 'rgb(190,190,190)'
  })
}

// A block covers a single displayed region, which can be a slice of the
// chromosome, so clip each band to it and drop the ones that fall outside.
// Projecting an out-of-block coord returns undefined, and treating that as px 0
// used to draw runaway triangles and duplicate the centromere in every block.
function layoutBands(
  cytobands: Cytoband[],
  overview: ViewLayout,
  block: ContentBlock,
) {
  const { displayedRegionIndex, reversed } = block
  const firstAcenIdx = cytobands.findIndex(({ type }) => type === 'acen')
  const colors = bandColors(cytobands)
  return cytobands
    .map((band, index) => {
      const { refName, type } = band
      const start = Math.max(band.start, block.start)
      const end = Math.min(band.end, block.end)
      const toPx = (coord: number) =>
        layoutBpToPx(overview, { refName, coord, displayedRegionIndex })
      const s = toPx(start)
      const e = toPx(end)
      return start < end && s !== undefined && e !== undefined
        ? {
            // name can be missing or duplicated; start/end uniquely identify it
            key: `${band.start}-${band.end}`,
            color: colors[index]!,
            left: Math.min(s, e),
            width: Math.abs(e - s),
            isAcen: type === 'acen',
            // the two acen bands always point at each other, meeting at the
            // centromere: the p arm points right and the q arm left, and both
            // flip when reversed puts the p arm on the right
            pointsRight: (index === firstAcenIdx) !== reversed,
          }
        : undefined
    })
    .filter(f => f !== undefined)
}

const Cytobands = observer(function Cytobands({
  overview,
  block,
  cytobands,
}: {
  overview: ViewLayout
  cytobands: Cytoband[]
  block: ContentBlock
}) {
  const { offsetPx, reversed } = block
  const h = HEADER_OVERVIEW_HEIGHT
  const bands = layoutBands(cytobands, overview, block)
  const lcap = reversed ? bands.length - 1 : 0
  const rcap = reversed ? 0 : bands.length - 1

  return (
    <g transform={`translate(-${offsetPx})`}>
      {bands.map(({ key, color, left, width, isAcen, pointsRight }, index) => {
        if (isAcen) {
          const triangle = pointsRight ? triangleRight : triangleLeft
          return (
            <polygon
              key={key}
              points={triangle(left, 0, width, h)}
              {...getFillProps(color)}
            />
          )
        }
        if (index === lcap || index === rcap) {
          const rect = index === lcap ? leftRoundedRect : rightRoundedRect
          return (
            <path
              key={key}
              d={rect(left, 0, width, h, 8)}
              {...getFillProps(color)}
            />
          )
        }
        return (
          <rect
            key={key}
            x={left}
            y={0}
            width={width}
            height={h}
            {...getFillProps(color)}
          />
        )
      })}
    </g>
  )
})

export default Cytobands
