import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import {
  ContentBlock as ContentBlockComponent,
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from '../../BaseLinearDisplay/components/Block.tsx'
import { makeTicks } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
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
  tick: {
    position: 'absolute',
    height: '100%',
    width: 1,
  },
  majorTick: {
    background: theme.palette.action.disabled,
  },
  minorTick: {
    background: theme.palette.divider,
  },
}))

function RenderedBlockLines({
  block,
  bpPerPx,
}: {
  block: ContentBlock
  bpPerPx: number
}) {
  const { classes } = useStyles()
  const { start, end, reversed } = block
  const ticks = makeTicks(start, end, bpPerPx)
  const majorTickClass = `${classes.tick} ${classes.majorTick}`
  const minorTickClass = `${classes.tick} ${classes.minorTick}`

  console.log('[Gridlines RenderedBlockLines]', {
    blockKey: block.key,
    start,
    end,
    reversed,
    bpPerPx,
    widthPx: block.widthPx,
    numTicks: ticks.length,
    samplePositions: ticks.slice(0, 5).map(({ base }) => ({
      base,
      x: (reversed ? end - base : base - start) / bpPerPx,
    })),
  })

  return (
    <ContentBlockComponent block={block}>
      {ticks.map(({ type, base }) => {
        const x = (reversed ? end - base : base - start) / bpPerPx
        return (
          <div
            key={base}
            className={
              type === 'major' || type === 'labeledMajor'
                ? majorTickClass
                : minorTickClass
            }
            style={{ left: x }}
          />
        )
      })}
    </ContentBlockComponent>
  )
}

const RenderedVerticalGuides = observer(function RenderedVerticalGuides({
  model,
}: {
  model: LGV
}) {
  const { staticBlocks, bpPerPx } = model
  console.log('[Gridlines RenderedVerticalGuides]', {
    numBlocks: staticBlocks.blocks.length,
    bpPerPx,
    blockTypes: staticBlocks.blocks.map(b => b.type),
  })
  return (
    <>
      {staticBlocks.map((block, index) => {
        const k = `${block.key}-${index}`
        if (block.type === 'ContentBlock') {
          return <RenderedBlockLines key={k} block={block} bpPerPx={bpPerPx} />
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

const Gridlines = observer(function Gridlines({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const { classes } = useStyles()
  const { staticBlocks, offsetPx } = model
  const offsetLeft = staticBlocks.offsetPx - offsetPx
  console.log('[Gridlines outer]', {
    offsetPx,
    staticBlocksOffsetPx: staticBlocks.offsetPx,
    offsetLeft,
    totalWidthPx: staticBlocks.totalWidthPx,
    numBlocks: staticBlocks.blocks.length,
  })
  return (
    <div className={classes.verticalGuidesZoomContainer}>
      <div
        className={classes.verticalGuidesContainer}
        style={{
          left: offsetLeft - offset,
          width: staticBlocks.totalWidthPx,
        }}
      >
        <RenderedVerticalGuides model={model} />
      </div>
    </div>
  )
})

export default Gridlines
