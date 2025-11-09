import { useEffect, useMemo, useRef } from 'react'

import { useTheme } from '@mui/material'
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

const useStyles = makeStyles()(theme => ({
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
  },
}))

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

    // Clear existing lines
    svg.innerHTML = ''

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
    svg.append(fragment)
  }, [block.start, block.end, block.reversed, bpPerPx, majorColor, minorColor])

  return (
    <ContentBlockComponent block={block}>
      <svg ref={svgRef} className={classes.svgOverlay} />
    </ContentBlockComponent>
  )
}
const RenderedVerticalGuides = observer(({ model }: { model: LGV }) => {
  const { staticBlocks, bpPerPx } = model
  const theme = useTheme()

  // Memoize colors to prevent unnecessary recalculations
  const { majorColor, minorColor } = useMemo(
    () => ({
      majorColor: theme.palette.action.disabled,
      minorColor: theme.palette.divider,
    }),
    [theme.palette.action.disabled, theme.palette.divider],
  )

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
              majorColor={majorColor}
              minorColor={minorColor}
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
const Gridlines = observer(function ({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const { classes } = useStyles()
  // find the block that needs pinning to the left side for context
  const offsetLeft = model.staticBlocks.offsetPx - model.offsetPx
  return (
    <div
      className={classes.verticalGuidesZoomContainer}
      style={{
        transform:
          model.scaleFactor !== 1 ? `scaleX(${model.scaleFactor})` : undefined,
      }}
    >
      <div
        className={classes.verticalGuidesContainer}
        style={{
          left: offsetLeft - offset,
          width: model.staticBlocks.totalWidthPx,
        }}
      >
        <RenderedVerticalGuides model={model} />
      </div>
    </div>
  )
})

export default Gridlines
