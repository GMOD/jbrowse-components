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
  minorLine: {
    stroke: theme.palette.gridlineMinor,
  },
  majorLine: {
    stroke: theme.palette.gridlineMajor,
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

  // All tick marks collapse into two <path>s (minor + major) rather than one div
  // each: zoom rebuilds two `d` strings and patches two attributes instead of
  // reconciling ~150 nodes per frame. Vector stays crisp at any DPR with no
  // canvas pixel-buffer size cap; +0.5 centers the 1px stroke on a pixel column
  // to match the old divs; lines run to y=100000 and are clipped by the svg box,
  // so we never measure the height.
  let minorD = ''
  let majorD = ''
  for (const { x, major } of gridlineTicks) {
    const seg = `M${x + 0.5} 0V100000`
    if (major) {
      majorD += seg
    } else {
      minorD += seg
    }
  }

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
      <svg className={classes.absoluteFill}>
        <path d={minorD} className={classes.minorLine} strokeWidth={1} />
        <path d={majorD} className={classes.majorLine} strokeWidth={1} />
      </svg>
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
