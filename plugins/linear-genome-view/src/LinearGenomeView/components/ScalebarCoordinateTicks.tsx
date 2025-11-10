import { useEffect, useRef } from 'react'

import { getTickDisplayStr } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import { makeTicks } from '../util'

import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

const ScalebarCoordinateTicks = function ({
  block,
  bpPerPx,
}: {
  block: ContentBlock
  bpPerPx: number
}) {
  const { reversed, start, end, widthPx } = block
  const containerRef = useRef<HTMLDivElement>(null)
  const theme = useTheme()

  // Update tick labels directly using DOM manipulation when dependencies change
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const ticks = makeTicks(start, end, bpPerPx, true, false)

    // Clear existing tick labels
    container.innerHTML = ''

    // Create tick labels directly in DOM using appendChild
    const fragment = document.createDocumentFragment()
    for (const { type, base } of ticks) {
      if (type === 'major') {
        const x = (reversed ? end - base : base - start) / bpPerPx
        const baseNumber = base + 1
        if (baseNumber) {
          // Create outer tick container
          const tickDiv = document.createElement('div')
          tickDiv.style.position = 'absolute'
          tickDiv.style.width = '0'
          tickDiv.style.display = 'flex'
          tickDiv.style.justifyContent = 'center'
          tickDiv.style.pointerEvents = 'none'
          tickDiv.style.left = `${x}px`

          // Create label div
          const labelDiv = document.createElement('div')
          labelDiv.style.fontSize = '11px'
          labelDiv.style.zIndex = '1'
          labelDiv.style.background = theme.palette.background.paper
          labelDiv.style.lineHeight = 'normal'
          labelDiv.style.pointerEvents = 'none'
          labelDiv.textContent = getTickDisplayStr(baseNumber, bpPerPx)

          tickDiv.appendChild(labelDiv)
          fragment.appendChild(tickDiv)
        }
      }
    }
    container.appendChild(fragment)
  }, [start, end, reversed, bpPerPx, theme.palette.background.paper])

  return (
    <div
      ref={containerRef}
      style={{ width: widthPx, position: 'relative', minHeight: '100%' }}
    />
  )
}

export default ScalebarCoordinateTicks
