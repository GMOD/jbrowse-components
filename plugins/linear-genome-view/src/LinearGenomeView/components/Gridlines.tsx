import { useEffect, useRef } from 'react'

import { useTheme } from '@mui/material'
import { autorun } from 'mobx'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import {
  ContentBlock as ContentBlockComponent,
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from '../../BaseLinearDisplay/components/Block'
import { makeTicks } from '../util'

import type { LinearGenomeViewModel } from '..'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

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
    display: 'flex',
  },
  svgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    // Reduce layout shift by containing layout/paint changes
    contain: 'layout style paint',
  },
})

function RenderedBlockLines({
  block,
  bpPerPx,
  majorColor,
  minorColor,
}: {
  block: ContentBlock
  bpPerPx: number
  majorColor: string
  minorColor: string
}) {
  const { classes } = useStyles()
  const svgRef = useRef<SVGSVGElement>(null)

  // Update SVG lines directly using appendChild when dependencies change
  // Proper useEffect dependency array ensures MobX synchronization
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const ticks = makeTicks(block.start, block.end, bpPerPx)

    // Create lines directly in SVG using appendChild
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
        type === 'major' || type === 'labeledMajor' ? majorColor : minorColor,
      )
      line.setAttribute('stroke-width', '1')
      fragment.append(line)
    }
    // Use replaceChildren for atomic update - reduces layout shift vs innerHTML='' + append
    svg.replaceChildren(fragment)
  }, [block.start, block.end, block.reversed, bpPerPx, majorColor, minorColor])

  return (
    <ContentBlockComponent block={block}>
      <svg ref={svgRef} className={classes.svgOverlay} />
    </ContentBlockComponent>
  )
}
const RenderedVerticalGuides = observer(function ({ model }: { model: LGV }) {
  const { staticBlocks, bpPerPx } = model
  const theme = useTheme()
  return (
    <>
      {staticBlocks.map((block, index) => {
        const k = `${block.key}-${index}`
        if (block.type === 'ContentBlock') {
          return (
            <RenderedBlockLines
              key={k}
              block={block}
              bpPerPx={bpPerPx}
              majorColor={theme.palette.action.disabled}
              minorColor={theme.palette.divider}
            />
          )
        } else if (block.type === 'ElidedBlock') {
          return <ElidedBlockComponent key={k} width={block.widthPx} />
        } else if (block.type === 'InterRegionPaddingBlock') {
          return (
            <InterRegionPaddingBlockComponent
              key={k}
              width={block.widthPx}
              boundary={block.variant === 'boundary'}
            />
          )
        }
        return null
      })}
    </>
  )
})
function Gridlines({ model, offset = 0 }: { model: LGV; offset?: number }) {
  const { classes } = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return autorun(() => {
      const { scaleFactor } = model
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
      const inner = innerRef.current
      if (inner) {
        const offsetLeft = staticBlocks.offsetPx - offsetPx
        inner.style.transform = `translateX(${offsetLeft - offset}px)`
        inner.style.width = `${staticBlocks.totalWidthPx}px`
      }
    })
  }, [model, offset])

  return (
    <div ref={containerRef} className={classes.verticalGuidesZoomContainer}>
      <div ref={innerRef} className={classes.verticalGuidesContainer}>
        <RenderedVerticalGuides model={model} />
      </div>
    </div>
  )
}

export default Gridlines
