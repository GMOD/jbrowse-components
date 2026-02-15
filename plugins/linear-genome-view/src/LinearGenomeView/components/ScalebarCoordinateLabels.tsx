import { useEffect, useRef } from 'react'

import { getTickDisplayStr } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { makeTicks } from '../util.ts'
import { joinElements } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const WRAPPER_BASE_STYLE =
  'position:relative;flex-shrink:0;overflow:hidden;height:13px'
const ELIDED_BG =
  'background-color:#999;background-image:repeating-linear-gradient(90deg,transparent,transparent 1px,rgba(255,255,255,.5) 1px,rgba(255,255,255,.5) 3px)'

function createTickElement() {
  const tick = document.createElement('div')
  tick.style.cssText =
    'position:absolute;width:0;display:flex;justify-content:center;pointer-events:none'
  const label = document.createElement('div')
  label.style.cssText =
    'font-size:11px;z-index:1;line-height:normal;pointer-events:none'
  tick.appendChild(label)
  return tick
}

function joinTickElements(wrapper: HTMLElement, count: number) {
  while (wrapper.childElementCount > count) {
    wrapper.lastElementChild!.remove()
  }
  while (wrapper.childElementCount < count) {
    wrapper.appendChild(createTickElement())
  }
}

function createWrapperDiv() {
  const el = document.createElement('div')
  el.style.cssText = WRAPPER_BASE_STYLE
  return el
}

export default function ScalebarCoordinateLabels({
  model,
}: {
  model: LGV
}) {
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const labelBg = theme.palette.background.paper

    return autorun(() => {
      const container = containerRef.current
      if (!container) {
        return
      }
      const { staticBlocks, bpPerPx } = model
      const blocks = staticBlocks.blocks

      joinElements(container, blocks.length, createWrapperDiv)

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i]!
        const wrapper = container.children[i] as HTMLElement

        if (block.type === 'ContentBlock') {
          const { start, end, reversed } = block
          const ticks = makeTicks(start, end, bpPerPx, true, false)

          wrapper.style.width = `${block.widthPx}px`

          joinTickElements(wrapper, ticks.length)

          for (let j = 0; j < ticks.length; j++) {
            const { base } = ticks[j]!
            const tick = wrapper.children[j] as HTMLElement
            tick.style.transform = `translateX(${(reversed ? end - base : base - start) / bpPerPx}px)`
            const label = tick.firstElementChild as HTMLElement
            label.style.background = labelBg
            label.textContent = getTickDisplayStr(base + 1, bpPerPx)
          }
        } else if (block.type === 'ElidedBlock') {
          wrapper.style.cssText = `flex-shrink:0;height:13px;width:${block.widthPx}px;${ELIDED_BG}`
          while (wrapper.firstChild) {
            wrapper.firstChild.remove()
          }
        } else {
          wrapper.style.cssText = `flex-shrink:0;height:13px;width:${block.widthPx}px`
          while (wrapper.firstChild) {
            wrapper.firstChild.remove()
          }
        }
      }
    })
  }, [model, theme])

  return <div ref={containerRef} style={{ display: 'flex' }} />
}
