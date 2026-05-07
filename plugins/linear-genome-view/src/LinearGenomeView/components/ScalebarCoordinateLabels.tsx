import { getTickDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { makeTicks } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { BaseBlock, ContentBlock } from '@jbrowse/core/util/blockTypes'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
  },
  wrapper: {
    position: 'relative',
    flexShrink: 0,
    overflow: 'hidden',
    height: 13,
  },
  spacer: {
    flexShrink: 0,
    height: 13,
  },
  elided: {
    backgroundColor: '#999',
    backgroundImage:
      'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,.5) 1px, rgba(255,255,255,.5) 3px)',
  },
  tick: {
    position: 'absolute',
    width: 0,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  tickLabel: {
    fontSize: 11,
    zIndex: 1,
    lineHeight: 'normal',
    pointerEvents: 'none',
    background: theme.palette.background.paper,
  },
}))

const ContentBlockTicks = observer(function ContentBlockTicks({
  block,
  bpPerPx,
}: {
  block: ContentBlock
  bpPerPx: number
}) {
  const { classes } = useStyles()
  const { start, end, reversed, widthPx } = block

  if (widthPx < 20) {
    return <div className={classes.wrapper} style={{ width: widthPx }} />
  }

  const ticks = makeTicks(start, end, bpPerPx, true, false)
  return (
    <div className={classes.wrapper} style={{ width: widthPx }}>
      {ticks.map(({ base }) => (
        <div
          key={base}
          className={classes.tick}
          style={{
            transform: `translateX(${(reversed ? end - base : base - start) / bpPerPx}px)`,
          }}
        >
          <div className={classes.tickLabel}>
            {getTickDisplayStr(base + 1, bpPerPx)}
          </div>
        </div>
      ))}
    </div>
  )
})

function NonContentSpacer({ block }: { block: BaseBlock }) {
  const { classes, cx } = useStyles()
  return (
    <div
      className={cx(
        classes.spacer,
        block.type === 'ElidedBlock' && classes.elided,
      )}
      style={{ width: block.widthPx }}
    />
  )
}

const ScalebarCoordinateLabels = observer(function ScalebarCoordinateLabels({
  model,
}: {
  model: LGV
}) {
  const { classes } = useStyles()
  const { staticBlocks, bpPerPx } = model

  return (
    <div className={classes.container}>
      {staticBlocks.blocks.map(block =>
        block.type === 'ContentBlock' ? (
          <ContentBlockTicks key={block.key} block={block} bpPerPx={bpPerPx} />
        ) : (
          <NonContentSpacer key={block.key} block={block} />
        ),
      )}
    </div>
  )
})

export default ScalebarCoordinateLabels
