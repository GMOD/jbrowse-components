import { getTickDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { elidedBlockStyles } from './util.ts'
import { makeBlockTicks } from '../util.ts'

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
    ...elidedBlockStyles,
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
    // paper backing so the number stays readable over the gridline behind it
    background: theme.palette.background.paper,
    padding: '0 2px',
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
  const { widthPx } = block

  if (widthPx < 20) {
    return <div className={classes.wrapper} style={{ width: widthPx }} />
  }

  const ticks = makeBlockTicks(block, bpPerPx, true, false)
  return (
    <div className={classes.wrapper} style={{ width: widthPx }}>
      {/* key by base, not index: getTickDisplayStr text depends only on base,
      so reusing nodes by base keeps their text stable (no repaint) during zoom */}
      {ticks.map(({ base, x }) => (
        <div
          key={base}
          className={classes.tick}
          style={{ transform: `translateX(${x}px)` }}
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
