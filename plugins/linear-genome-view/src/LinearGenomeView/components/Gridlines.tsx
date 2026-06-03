import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { elidedBlockStyles } from './util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  verticalGuidesZoomContainer: {
    position: 'absolute',
    top: 0,
    height: '100%',
    width: '100%',
    pointerEvents: 'none',
  },
  innerContainer: {
    position: 'absolute',
    height: '100%',
    pointerEvents: 'none',
  },
  absoluteFill: {
    position: 'absolute',
    width: '100%',
    height: '100%',
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
  block: {
    position: 'absolute',
    height: '100%',
  },
  boundaryBlock: {
    background: theme.palette.action.disabledBackground,
  },
  regionSeparator: {
    background: theme.palette.text.disabled,
  },
  elided: {
    ...elidedBlockStyles,
  },
}))

// Reads only staticBlocks + the shared gridlineTicks view. Re-renders on zoom
// or region change, not on per-frame offsetPx changes — those move the outer
// transform only.
const GridlinesContent = observer(function GridlinesContent({
  model,
}: {
  model: LGV
}) {
  const { classes, cx } = useStyles()
  const { staticBlocks, gridlineTicks } = model
  const blocks = staticBlocks.blocks
  const firstBlockOffset = blocks[0]?.offsetPx ?? 0

  return (
    <>
      <div className={classes.absoluteFill}>
        {blocks.map(block => {
          if (block.type === 'ContentBlock') {
            return block.isRightEndOfDisplayedRegion ? (
              <div
                key={`${block.key}-sep`}
                className={cx(classes.block, classes.regionSeparator)}
                style={{
                  transform: `translateX(${block.offsetPx - firstBlockOffset + block.widthPx - 1}px)`,
                  width: 3,
                }}
              />
            ) : null
          }
          const bgClass =
            block.type === 'ElidedBlock'
              ? classes.elided
              : classes.boundaryBlock
          return (
            <div
              key={block.key}
              className={cx(classes.block, bgClass)}
              style={{
                transform: `translateX(${block.offsetPx - firstBlockOffset}px)`,
                width: block.widthPx,
              }}
            />
          )
        })}
      </div>
      <div className={classes.absoluteFill}>
        {gridlineTicks.map(({ key, x, major }) => (
          <div
            key={key}
            className={cx(
              classes.tick,
              major ? classes.majorTick : classes.minorTick,
            )}
            style={{ transform: `translateX(${x}px)` }}
          />
        ))}
      </div>
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

  return (
    <div className={classes.verticalGuidesZoomContainer}>
      <div
        className={classes.innerContainer}
        style={{
          transform: `translateX(${staticBlocks.offsetPx - offsetPx - offset}px)`,
          width: staticBlocks.totalWidthPx,
        }}
      >
        <GridlinesContent model={model} />
      </div>
    </div>
  )
})

export default Gridlines
