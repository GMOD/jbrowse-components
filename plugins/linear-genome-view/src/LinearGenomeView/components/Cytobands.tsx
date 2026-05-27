import { getFillProps } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// core
import { getCytobands } from './util.ts'
import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'

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

function leftTriangle(x: number, _y: number, width: number, height: number) {
  return [
    [x, 0],
    [x + width, height / 2],
    [x, height],
  ].toString()
}

function rightTriangle(x: number, _y: number, width: number, height: number) {
  return [
    [x, height / 2],
    [x + width, 0],
    [x + width, height],
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

const Cytobands = observer(function Cytobands({
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

  // Precompute per-band derived data so render is a pure map over already-
  // resolved state (no mutable accumulators during JSX construction).
  let centromereSeen = false
  let prevNaKey = ''
  let naIdx = 0
  const bands = cytobands.map(args => {
    const { refName, name, type, start, end } = args
    const s = overview.bpToPx({ refName, coord: start }) ?? 0
    const e = overview.bpToPx({ refName, coord: end }) ?? 0
    if (type === 'n/a') {
      const [, naDigits, naLetter] = name?.match(/^(\d+)([A-Za-z])/) ?? []
      const key = naDigits && naLetter ? naDigits + naLetter : ''
      if (key && key !== prevNaKey) {
        prevNaKey = key
        naIdx++
      }
    }
    const color =
      type === 'n/a'
        ? naIdx % 2
          ? 'black'
          : '#a77'
        : colorMap[type] || 'black'
    const isFirstAcen = type === 'acen' && !centromereSeen
    if (type === 'acen') {
      centromereSeen = true
    }
    return { args, s, e, color, isFirstAcen }
  })

  return (
    <g transform={`translate(-${offsetPx})`}>
      {bands.map(({ args, s, e, color, isFirstAcen }, index) => {
        const k = JSON.stringify(args)
        const { type } = args
        const l = Math.min(s, e)
        const w = Math.abs(e - s)

        if (type === 'acen') {
          const x = reversed ? s - w : s
          const points =
            isFirstAcen !== reversed
              ? leftTriangle(x, 0, w, h)
              : rightTriangle(x, 0, w, h)
          return <polygon key={k} points={points} {...getFillProps(color)} />
        }
        if (lcap === index) {
          return (
            <path
              key={k}
              d={leftRoundedRect(l, 0, w, h, 8)}
              {...getFillProps(color)}
            />
          )
        }
        if (rcap === index) {
          return (
            <path
              key={k}
              d={rightRoundedRect(l, 0, w, h, 8)}
              {...getFillProps(color)}
            />
          )
        }
        return (
          <rect
            key={k}
            x={l}
            y={0}
            width={w}
            height={h}
            {...getFillProps(color)}
          />
        )
      })}
    </g>
  )
})

export default Cytobands
