import { useEffect, useRef } from 'react'

import { getTickDisplayStr } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { makeTicks } from '../util'

import type { LinearGenomeViewModel } from '..'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

type LGV = LinearGenomeViewModel

function createBlockElement(
  block: BaseBlock,
  bpPerPx: number,
  bgColor: string,
) {
  const div = document.createElement('div')
  div.style.width = `${block.widthPx}px`
  div.style.position = 'relative'
  div.style.flexShrink = '0'
  div.style.overflow = 'hidden'
  div.style.height = '13px'

  if (block.type === 'ContentBlock') {
    const ticks = makeTicks(block.start, block.end, bpPerPx, true, false)
    const fragment = document.createDocumentFragment()

    for (const { type, base } of ticks) {
      if (type === 'major') {
        const x =
          (block.reversed ? block.end - base : base - block.start) / bpPerPx
        const baseNumber = base + 1
        if (baseNumber) {
          const tickDiv = document.createElement('div')
          tickDiv.style.position = 'absolute'
          tickDiv.style.width = '0'
          tickDiv.style.display = 'flex'
          tickDiv.style.justifyContent = 'center'
          tickDiv.style.pointerEvents = 'none'
          tickDiv.style.left = `${x}px`

          const labelDiv = document.createElement('div')
          labelDiv.style.fontSize = '11px'
          labelDiv.style.zIndex = '1'
          labelDiv.style.background = bgColor
          labelDiv.style.lineHeight = 'normal'
          labelDiv.style.pointerEvents = 'none'
          labelDiv.textContent = getTickDisplayStr(baseNumber, bpPerPx)

          tickDiv.append(labelDiv)
          fragment.append(tickDiv)
        }
      }
    }
    div.append(fragment)
  } else if (block.type === 'ElidedBlock') {
    div.style.minHeight = '100%'
    div.style.boxSizing = 'border-box'
    div.style.backgroundColor = '#999'
    div.style.backgroundImage =
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)'
  }
  // InterRegionPaddingBlock renders as empty div (background: none in original)

  return div
}

function ScalebarCoordinateLabels({ model }: { model: LGV }) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bgColor = theme.palette.background.paper

    return autorun(() => {
      const { staticBlocks, bpPerPx } = model
      const container = containerRef.current
      if (!container) {
        return
      }

      const existingKeys = new Map<string, HTMLDivElement>()
      for (const child of container.children) {
        const key = (child as HTMLElement).dataset.blockKey
        if (key) {
          existingKeys.set(key, child as HTMLDivElement)
        }
      }

      const fragment = document.createDocumentFragment()

      for (const block of staticBlocks) {
        const key = block.key
        let div = existingKeys.get(key)
        if (!div) {
          div = createBlockElement(block, bpPerPx, bgColor)
          div.dataset.blockKey = key
        }
        fragment.append(div)
      }

      container.replaceChildren(fragment)
    })
  }, [model, theme])

  return <div ref={containerRef} style={{ display: 'flex' }} />
}

export default ScalebarCoordinateLabels
