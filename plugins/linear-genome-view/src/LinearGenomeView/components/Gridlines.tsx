import { memo, useEffect, useMemo, useRef } from 'react'

import { reaction } from 'mobx'
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
    contain: 'layout style paint',
  },
  verticalGuidesContainer: {
    position: 'absolute',
    height: '100%',
    pointerEvents: 'none',
    display: 'flex',
    contain: 'layout style',
  },
  tick: {
    position: 'absolute',
    height: '100%',
    width: 1,
    willChange: 'transform',
  },
  majorTick: {
    background: theme.palette.action.disabled,
  },
  minorTick: {
    background: theme.palette.divider,
  },
}))

const RenderedBlockLines = memo(
  observer(function RenderedBlockLines({
    block,
    bpPerPx,
  }: {
    block: ContentBlock
    bpPerPx: number
  }) {
    const { classes, cx } = useStyles()
    const ticks = makeTicks(block.start, block.end, bpPerPx)
    console.log('wtf3')

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
              style={{ transform: `translateX(${x}px)` }}
            />
          )
        })}
      </ContentBlockComponent>
    )
  }),
  (prevProps, nextProps) => {
    // Only re-render if block key or bpPerPx actually changes
    return (
      prevProps.block.key === nextProps.block.key &&
      prevProps.bpPerPx === nextProps.bpPerPx
    )
  },
)

const RenderedVerticalGuides = observer(function ({ model }: { model: LGV }) {
  const { coarseStaticBlocks, bpPerPx } = model

  // Create a stable key based on block keys to prevent unnecessary re-renders
  const blocksKey = useMemo(
    () =>
      coarseStaticBlocks
        ? coarseStaticBlocks.map(b => `${b.key}-${b.widthPx}`).join(',')
        : '',
    [coarseStaticBlocks],
  )

  const blockElements = useMemo(() => {
    console.log('wtf2')
    return coarseStaticBlocks ? (
      <>
        {coarseStaticBlocks.map((block, index) => {
          const k = `${block.key}-${index}`
          if (block.type === 'ContentBlock') {
            return (
              <RenderedBlockLines key={k} block={block} bpPerPx={bpPerPx} />
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
    ) : (
      coarseStaticBlocks
    )
  }, [blocksKey, coarseStaticBlocks, bpPerPx])

  return blockElements
})

const Gridlines = observer(function ({
  model,
  offset = 0,
}: {
  model: LGV
  offset?: number
}) {
  const { classes } = useStyles()
  const containerRef = useRef<HTMLDivElement>(null)
  const guidesRef = useRef<HTMLDivElement>(null)
  console.log('wtf1')

  // Use MobX reaction to update DOM directly without triggering React re-renders
  useEffect(() => {
    const container = containerRef.current
    const guides = guidesRef.current
    if (!container || !guides) {
      return
    }

    // MobX reaction tracks observables and updates DOM directly
    const disposer = reaction(
      () => ({
        scaleFactor: model.scaleFactor,
        offsetPx: model.offsetPx,
        blocksOffsetPx: model.coarseStaticBlocks?.offsetPx,
        totalWidthPx: model.coarseStaticBlocks?.totalWidthPx,
      }),
      ({ scaleFactor, offsetPx, blocksOffsetPx, totalWidthPx }) => {
        // Update scale transform
        container.style.transform =
          scaleFactor !== 1 ? `scaleX(${scaleFactor})` : ''

        // Update position and width
        if (blocksOffsetPx !== undefined && totalWidthPx !== undefined) {
          const translateX = blocksOffsetPx - offsetPx - offset
          guides.style.transform = `translateX(${translateX}px)`
          guides.style.width = `${totalWidthPx}px`
        }
      },
      { fireImmediately: true },
    )

    return disposer
  }, [model, offset])

  return (
    <div ref={containerRef} className={classes.verticalGuidesZoomContainer}>
      <div ref={guidesRef} className={classes.verticalGuidesContainer}>
        <RenderedVerticalGuides model={model} />
      </div>
    </div>
  )
})

export default Gridlines
