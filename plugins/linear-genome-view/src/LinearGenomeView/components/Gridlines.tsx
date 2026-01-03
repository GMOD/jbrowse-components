import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

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
  // Outer container that handles zoom scaling via CSS transform
  verticalGuidesZoomContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: '100%',
    pointerEvents: 'none',
  },
  // Inner container positioned using CSS calc() with --offset-px variable
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
  const { staticBlocks, scaleFactor } = model
  return (
    <div
      className={classes.verticalGuidesZoomContainer}
      style={{
        transform: scaleFactor !== 1 ? `scaleX(${scaleFactor})` : undefined,
      }}
    >
      <div
        className={classes.verticalGuidesContainer}
        style={{
          // Uses --offset-px CSS variable from parent (TracksContainer or Scalebar)
          left: `calc(${staticBlocks.offsetPx}px - var(--offset-px) - ${offset}px)`,
          width: staticBlocks.totalWidthPx,
        }}
      >
        <RenderedVerticalGuides model={model} />
      </div>
    </div>
  )
})

export default Gridlines
