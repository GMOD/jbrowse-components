import React from 'react'
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
    height: '100%',
    width: '100%',
    zIndex: 1,
    pointerEvents: 'none',
  },
  verticalGuidesContainer: {
    position: 'absolute',
    height: '100%',
    zIndex: 1,
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
  const { classes, cx } = useStyles()
  const ticks = makeTicks(block.start, block.end, bpPerPx)
  return (
    <ContentBlockComponent block={block}>
      {ticks.map(({ type, base }) => {
        const x =
          (block.reversed ? block.end - base : base - block.start) / bpPerPx
        return (
          <div
            key={base}
            className={cx(
              classes.tick,
              type === 'major' || type === 'labeledMajor'
                ? classes.majorTick
                : classes.minorTick,
            )}
            style={{ left: x }}
          />
        )
      })}
    </ContentBlockComponent>
  )
}
const RenderedVerticalGuides = observer(({ model }: { model: LGV }) => {
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
const Gridlines = observer(function ({ model }: { model: LGV }) {
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
          left: offsetLeft,
          width: model.staticBlocks.totalWidthPx,
        }}
      >
        <RenderedVerticalGuides model={model} />
      </div>
    </div>
  )
})

export default Gridlines
