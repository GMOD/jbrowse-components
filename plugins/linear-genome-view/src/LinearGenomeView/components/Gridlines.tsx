import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { makeStyles } from 'tss-react/mui'

import { makeTicks } from '../util'

import type { LinearGenomeViewModel } from '..'
import type { BaseBlock, ContentBlock } from '@jbrowse/core/util/blockTypes'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  verticalGuidesZoomContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: '100%',
    pointerEvents: 'none',
  },
  verticalGuidesContainer: {
    position: 'absolute',
    height: '100%',
    pointerEvents: 'none',
  },
})

function renderBlockSvgLines(
  svg: SVGSVGElement,
  block: ContentBlock,
  bpPerPx: number,
  majorColor: string,
  minorColor: string,
) {
  console.log('renderBlockSvgLines')
  const ticks = makeTicks(block.start, block.end, bpPerPx)
  const fragment = document.createDocumentFragment()
  for (const { type, base } of ticks) {
    const x = (block.reversed ? block.end - base : base - block.start) / bpPerPx
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(x))
    line.setAttribute('y1', '0')
    line.setAttribute('x2', String(x))
    line.setAttribute('y2', '100%')
    line.setAttribute(
      'stroke',
      type === 'major' || type === 'labeledMajor' ? majorColor : minorColor,
    )
    line.setAttribute('stroke-width', '1')
    fragment.append(line)
  }
  svg.replaceChildren(fragment)
}

function createBlockElement(block: BaseBlock): HTMLDivElement {
  const div = document.createElement('div')
  console.log('createBlockElements')
  div.style.height = '100%'
  div.style.flexShrink = '0'
  div.style.position = 'relative'
  div.style.width = `${block.widthPx}px`

  if (block.type === 'ContentBlock') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.style.position = 'absolute'
    svg.style.top = '0'
    svg.style.left = '0'
    svg.style.width = '100%'
    svg.style.height = '100%'
    svg.style.pointerEvents = 'none'
    svg.setAttribute('data-block-key', block.key)
    div.appendChild(svg)
  }

  return div
}
function Gridlines({ model, offset = 0 }: { model: LGV; offset?: number }) {
  const { classes } = useStyles()
  const theme = useTheme()
  console.log('Gridlines')
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return autorun(() => {
      const { scaleFactor } = model
      console.log('Gridlines autorun (scaleFactor)')
      const container = containerRef.current
      if (container) {
        container.style.transform =
          scaleFactor !== 1 ? `scaleX(${scaleFactor})` : ''
      }
    })
  }, [model])

  useEffect(() => {
    return autorun(() => {
      const { staticBlocks, offsetPx } = model
      console.log('Gridlines autorun (offsetPx)')
      const inner = innerRef.current
      if (inner) {
        const offsetLeft = staticBlocks.offsetPx - offsetPx
        inner.style.transform = `translateX(${offsetLeft - offset}px)`
        inner.style.width = `${staticBlocks.totalWidthPx}px`
      }
    })
  }, [model, offset])

  useEffect(() => {
    const majorColor = theme.palette.action.disabled
    const minorColor = theme.palette.divider

    return autorun(() => {
      const { staticBlocks, bpPerPx } = model
      console.log('Gridlines autorun (staticBlocks)')
      const inner = innerRef.current
      if (!inner) {
        return
      }

      const existingKeys = new Map<string, HTMLDivElement>()
      for (const child of inner.children) {
        const key = (child as HTMLElement).dataset.blockKey
        if (key) {
          existingKeys.set(key, child as HTMLDivElement)
        }
      }

      const fragment = document.createDocumentFragment()
      const newKeys = new Set<string>()

      for (const block of staticBlocks) {
        const key = block.key
        newKeys.add(key)

        let div = existingKeys.get(key)
        if (!div) {
          div = createBlockElement(block)
          div.dataset.blockKey = key
        } else {
          div.style.width = `${block.widthPx}px`
        }

        if (block.type === 'ContentBlock') {
          const svg = div.querySelector('svg')
          if (svg) {
            renderBlockSvgLines(svg, block, bpPerPx, majorColor, minorColor)
          }
        }

        fragment.appendChild(div)
      }

      inner.replaceChildren(fragment)
    })
  }, [model, theme])

  return (
    <div ref={containerRef} className={classes.verticalGuidesZoomContainer}>
      <div
        ref={innerRef}
        className={classes.verticalGuidesContainer}
        style={{ display: 'flex' }}
      />
    </div>
  )
}

export default Gridlines
