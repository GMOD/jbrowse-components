import { memo, useMemo } from 'react'

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

const RenderedBlockLines = memo(function RenderedBlockLines({
  block,
  bpPerPx,
}: {
  block: ContentBlock
  bpPerPx: number
}) {
  const { classes, cx } = useStyles()
  const ticks = useMemo(
    () => makeTicks(block.start, block.end, bpPerPx),
    [block.start, block.end, bpPerPx],
  )

  const tickElements = useMemo(
    () =>
      ticks.map(({ type, base }) => {
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
      }),
    [ticks, block.reversed, block.end, block.start, bpPerPx, classes, cx],
  )

  return (
    <ContentBlockComponent block={block}>{tickElements}</ContentBlockComponent>
  )
})
const RenderedVerticalGuides = observer(({ model }: { model: LGV }) => {
  const { staticBlocks, bpPerPx } = model

  const blockElements = useMemo(
    () =>
      staticBlocks.map((block, index) => {
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
      }),
    [staticBlocks, bpPerPx],
  )

  return <>{blockElements}</>
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
