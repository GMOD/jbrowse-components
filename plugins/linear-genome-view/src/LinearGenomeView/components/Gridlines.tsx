import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { makeTicks } from '../util.ts'

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
  textDisabledBlock: {
    background: theme.palette.text.disabled,
  },
  elided: {
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },
}))

// Reads only staticBlocks + bpPerPx. Re-renders on zoom or region change,
// not on per-frame offsetPx changes — those move the outer transform only.
const GridlinesContent = observer(function GridlinesContent({
  model,
}: {
  model: LGV
}) {
  const { classes, cx } = useStyles()
  const { staticBlocks, bpPerPx } = model
  const blocks = staticBlocks.blocks
  const firstBlockOffset = blocks[0]?.offsetPx ?? 0

  const ticks: { key: string; x: number; major: boolean }[] = []
  for (const block of blocks) {
    if (block.type !== 'ContentBlock') {
      continue
    }
    const { start, end, reversed, widthPx } = block
    const blockLeft = block.offsetPx - firstBlockOffset
    for (const { type, base } of makeTicks(start, end, bpPerPx)) {
      const x = blockLeft + (reversed ? end - base : base - start) / bpPerPx
      if (x >= blockLeft && x <= blockLeft + widthPx) {
        ticks.push({
          key: `${block.key}-${base}`,
          x,
          major: type === 'major' || type === 'labeledMajor',
        })
      }
    }
  }

  return (
    <>
      <div className={classes.absoluteFill}>
        {blocks.map(block => {
          if (block.type === 'ContentBlock') {
            return null
          }
          const bgClass =
            block.type === 'ElidedBlock'
              ? classes.elided
              : block.variant === 'boundary'
                ? classes.boundaryBlock
                : classes.textDisabledBlock
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
        {ticks.map(({ key, x, major }) => (
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
