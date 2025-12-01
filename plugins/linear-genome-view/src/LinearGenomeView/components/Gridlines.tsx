import { useEffect, useRef } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { autorun } from 'mobx'

import { makeTicks } from '../util'

import type { LinearGenomeViewModel } from '..'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

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
    display: 'flex',
    height: '100%',
    pointerEvents: 'none',
  },
})

function createBlockElement(
  block: BaseBlock,
  bpPerPx: number,
  colors: {
    major: string
    minor: string
    interRegionPadding: string
    boundaryPadding: string
  },
) {
  const div = document.createElement('div')
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
    div.append(svg)

    const ticks = makeTicks(block.start, block.end, bpPerPx)
    const fragment = document.createDocumentFragment()
    for (const { type, base } of ticks) {
      const x =
        (block.reversed ? block.end - base : base - block.start) / bpPerPx
      const line = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'line',
      )
      line.setAttribute('x1', String(x))
      line.setAttribute('y1', '0')
      line.setAttribute('x2', String(x))
      line.setAttribute('y2', '100%')
      line.setAttribute(
        'stroke',
        type === 'major' || type === 'labeledMajor'
          ? colors.major
          : colors.minor,
      )
      line.setAttribute('stroke-width', '1')
      fragment.append(line)
    }
    svg.append(fragment)
  } else if (block.type === 'ElidedBlock') {
    div.style.backgroundColor = '#999'
    div.style.backgroundImage =
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)'
  } else if (block.type === 'InterRegionPaddingBlock') {
    div.style.backgroundColor =
      block.variant === 'boundary'
        ? colors.boundaryPadding
        : colors.interRegionPadding
  }

  return div
}
function Gridlines({ model, offset = 0 }: { model: LGV; offset?: number }) {
  const { classes } = useStyles()
  const theme = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return autorun(
      function gridlinesZoomAutorun() {
        const { scaleFactor } = model
        const container = containerRef.current
        if (container) {
          container.style.transform =
            scaleFactor !== 1 ? `scaleX(${scaleFactor})` : ''
        }
      },
      { name: 'GridlinesZoom' },
    )
  }, [model])

  useEffect(() => {
    return autorun(
      function gridlinesTransformAutorun() {
        const { staticBlocks, offsetPx } = model
        const inner = innerRef.current
        if (inner) {
          const offsetLeft = staticBlocks.offsetPx - offsetPx
          inner.style.transform = `translateX(${offsetLeft - offset}px)`
          inner.style.width = `${staticBlocks.totalWidthPx}px`
        }
      },
      { name: 'GridlinesTransform' },
    )
  }, [model, offset])

  useEffect(() => {
    const colors = {
      major: theme.palette.action.disabled,
      minor: theme.palette.divider,
      interRegionPadding: theme.palette.text.disabled,
      boundaryPadding: theme.palette.action.disabledBackground,
    }

    return autorun(
      function gridlinesLayoutAutorun() {
        const { staticBlocks, bpPerPx } = model
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

        for (const block of staticBlocks) {
          const key = block.key
          let div = existingKeys.get(key)
          if (!div) {
            div = createBlockElement(block, bpPerPx, colors)
            div.dataset.blockKey = key
          }
          fragment.append(div)
        }

        inner.replaceChildren(fragment)
      },
      { name: 'GridlinesLayout' },
    )
  }, [model, theme])

  return (
    <div ref={containerRef} className={classes.verticalGuidesZoomContainer}>
      <div ref={innerRef} className={classes.verticalGuidesContainer} />
    </div>
  )
}

export default Gridlines
