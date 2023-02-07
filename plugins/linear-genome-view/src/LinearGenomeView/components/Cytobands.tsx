import React from 'react'
import { observer } from 'mobx-react'

// core
import { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import { ContentBlock } from '@jbrowse/core/util/blockTypes'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'

// locals
import { HEADER_OVERVIEW_HEIGHT } from '..'
import { getCytobands } from './util'

// rounded rect from https://stackoverflow.com/a/45889603/2129219
// prettier-ignore
function rightRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
  return "M" + x + "," + y
       + "h" + (width - radius)
       + "a" + radius + "," + radius + " 0 0 1 " + radius + "," + radius
       + "v" + (height - 2 * radius)
       + "a" + radius + "," + radius + " 0 0 1 " + -radius + "," + radius
       + "h" + (radius - width)
       + "z";
}

// prettier-ignore
function leftRoundedRect(x: number, y: number, width: number, height: number, radius: number ) {
  return "M" + (x + radius) + "," + y
       + "h" + (width - radius)
       + "v" + height
       + "h" + (radius - width)
       + "a" + radius + "," + radius + " 0 0 1 " + (-radius) + "," + (-radius)
       + "v" + (2 * radius - height)
       + "a" + radius + "," + radius + " 0 0 1 " + radius + "," + (-radius)
       + "z";
}

const colorMap: { [key: string]: string | undefined } = {
  gneg: 'rgb(227,227,227)',
  gpos25: 'rgb(142,142,142)',
  gpos50: 'rgb(85,85,85)',
  gpos100: 'rgb(0,0,0)',
  gpos75: 'rgb(57,57,57)',
  gvar: 'rgb(0,0,0)',
  stalk: 'rgb(127,127,127)',
  acen: '#800',
}

export default observer(function Cytobands({
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
  const coords = cytobands.map(f => {
    const { refName, start, end, type } = f
    return [
      overview.bpToPx({
        refName,
        coord: start,
      }),
      overview.bpToPx({
        refName,
        coord: end,
      }),
      type,
    ]
  })

  const arr = cytobands || []
  const lcap = reversed ? arr.length - 1 : 0
  const rcap = reversed ? 0 : arr.length - 1

  let firstCent = true
  return (
    <g transform={`translate(-${offsetPx})`}>
      {coords.map(([start, end, type], index) => {
        const key = `${start}-${end}-${type}`
        if (type === 'acen' && firstCent) {
          firstCent = false
          return (
            <polygon
              key={key}
              points={[
                [start, 0],
                [end, HEADER_OVERVIEW_HEIGHT / 2],
                [start, HEADER_OVERVIEW_HEIGHT],
              ].toString()}
              fill={colorMap[type]}
            />
          )
        }
        if (type === 'acen' && !firstCent) {
          return (
            <polygon
              key={key}
              points={[
                [start, HEADER_OVERVIEW_HEIGHT / 2],
                [end, 0],
                [end, HEADER_OVERVIEW_HEIGHT],
              ].toString()}
              fill={colorMap[type]}
            />
          )
        }

        if (lcap === index) {
          return (
            <path
              key={key}
              d={leftRoundedRect(
                Math.min(start, end),
                0,
                Math.abs(end - start),
                HEADER_OVERVIEW_HEIGHT,
                8,
              )}
              fill={colorMap[type]}
            />
          )
        } else if (rcap === index) {
          return (
            <path
              key={key}
              d={rightRoundedRect(
                Math.min(start, end),
                0,
                Math.abs(end - start) - 2,
                HEADER_OVERVIEW_HEIGHT,
                8,
              )}
              fill={colorMap[type]}
            />
          )
        } else {
          return (
            <rect
              key={key}
              x={Math.min(start, end)}
              y={0}
              width={Math.abs(end - start)}
              height={HEADER_OVERVIEW_HEIGHT}
              fill={colorMap[type]}
            />
          )
        }
      })}
    </g>
  )
})
