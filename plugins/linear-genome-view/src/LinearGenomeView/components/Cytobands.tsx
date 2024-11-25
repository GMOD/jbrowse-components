import React from 'react'

// core
import { getFillProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// locals
import { getCytobands } from './util'
import { HEADER_OVERVIEW_HEIGHT } from '../consts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
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

function leftTriangle(x: number, y: number, width: number, height: number) {
  return [
    [x, 0],
    [x + width, height / 2],
    [x, height],
  ].toString()
}

function rightTriangle(x: number, y: number, width: number, height: number) {
  return [
    [x, height / 2],
    [x + width, 0],
    [x + width, height],
  ].toString()
}

const colorMap: Record<string, string> = {
  gneg: 'rgb(227,227,227)',
  gpos25: 'rgb(142,142,142)',
  gpos50: 'rgb(85,85,85)',
  gpos100: 'rgb(0,0,0)',
  gpos75: 'rgb(57,57,57)',
  gvar: 'rgb(0,0,0)',
  stalk: 'rgb(127,127,127)',
  acen: '#800',
}

const Cytobands = observer(function ({
  overview,
  block,
  assembly,
}: {
  overview: Base1DViewModel
  assembly?: Assembly
  block: ContentBlock
}) {
  const { offsetPx, reversed } = block
  const cytobands = getCytobands(assembly, block.refName)
  const lcap = reversed ? cytobands.length - 1 : 0
  const rcap = reversed ? 0 : cytobands.length - 1

  const h = HEADER_OVERVIEW_HEIGHT
  let centromereSeen = false
  return (
    <g transform={`translate(-${offsetPx})`}>
      {cytobands.map((args, index) => {
        const k = JSON.stringify(args)
        const { refName, type, start, end } = args
        const s = overview.bpToPx({ refName, coord: start }) || 0
        const e = overview.bpToPx({ refName, coord: end }) || 0
        const l = Math.min(s, e)
        const w = Math.abs(e - s)
        const c = colorMap[type] || 'black'
        if (type === 'acen' && !centromereSeen) {
          centromereSeen = true // the next acen entry is drawn with different right triangle
          return (
            <polygon
              key={k}
              points={
                reversed
                  ? rightTriangle(s - w, 0, w, h)
                  : leftTriangle(s, 0, w, h)
              }
              {...getFillProps(c)}
            />
          )
        }
        if (type === 'acen' && centromereSeen) {
          return (
            <polygon
              key={k}
              points={
                reversed
                  ? leftTriangle(s - w, 0, w, h)
                  : rightTriangle(s, 0, w, h)
              }
              {...getFillProps(c)}
            />
          )
        }
        if (lcap === index) {
          return (
            <path
              key={k}
              d={leftRoundedRect(l, 0, w, h, 8)}
              {...getFillProps(c)}
            />
          )
        }
        if (rcap === index) {
          return (
            <path
              key={k}
              d={rightRoundedRect(l, 0, w, h, 8)}
              {...getFillProps(c)}
            />
          )
        }
        return (
          <rect key={k} x={l} y={0} width={w} height={h} {...getFillProps(c)} />
        )
      })}
    </g>
  )
})

export default Cytobands
