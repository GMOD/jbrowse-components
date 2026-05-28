import { getFillProps } from '@jbrowse/core/util'
import { layoutBpToPx } from '@jbrowse/core/util/Base1DUtils'
import { observer } from 'mobx-react'

// core
import { getCytobands } from './util.ts'
import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
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

function leftTriangle(x: number, y: number, width: number, height: number) {
  return [
    [x, y],
    [x + width, y + height / 2],
    [x, y + height],
  ].toString()
}

function rightTriangle(x: number, y: number, width: number, height: number) {
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

const Cytobands = observer(function Cytobands({
  overview,
  block,
  assembly,
}: {
  overview: ViewLayout
  assembly?: Assembly
  block: ContentBlock
}) {
  const { offsetPx, reversed } = block
  const cytobands = getCytobands(assembly, block.refName)
  const lcap = reversed ? cytobands.length - 1 : 0
  const rcap = reversed ? 0 : cytobands.length - 1
  const h = HEADER_OVERVIEW_HEIGHT

  const firstAcenIdx = cytobands.findIndex(({ type }) => type === 'acen')
  const naColorIndices: number[] = []
  let prevNaKey = ''
  let naColorIdx = 0
  for (const { name, type } of cytobands) {
    if (type === 'n/a') {
      const [, digits, letter] = name?.match(/^(\d+)([A-Za-z])/) ?? []
      const key = digits && letter ? digits + letter : ''
      if (key && key !== prevNaKey) {
        prevNaKey = key
        naColorIdx++
      }
    }
    naColorIndices.push(naColorIdx)
  }

  const bands = cytobands.map((args, index) => {
    const { refName, type, start, end } = args
    const s = layoutBpToPx(overview, { refName, coord: start }) ?? 0
    const e = layoutBpToPx(overview, { refName, coord: end }) ?? 0
    const color =
      type === 'n/a'
        ? naColorIndices[index]! % 2
          ? 'black'
          : '#a77'
        : colorMap[type] ?? 'black'
    return { args, s, e, color, isFirstAcen: index === firstAcenIdx }
  })

  return (
    <g transform={`translate(-${offsetPx})`}>
      {bands.map(({ args, s, e, color, isFirstAcen }, index) => {
        const k = args.name
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
