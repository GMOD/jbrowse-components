import { memo } from 'react'

import { getTickDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { makeTicks } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  block: {
    position: 'relative',
    flexShrink: 0,
    overflow: 'hidden',
    height: 13,
  },
  elidedBlock: {
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
  label: {
    fontSize: 11,
    zIndex: 1,
    background: theme.palette.background.paper,
    lineHeight: 'normal',
    pointerEvents: 'none',
  },
}))

const ContentBlockLabels = memo(
  function ContentBlockLabels({
    block,
    bpPerPx,
  }: {
    block: ContentBlock
    bpPerPx: number
  }) {
    console.log('[ContentBlockLabels] render', block.key)
    const { classes } = useStyles()
    const ticks = makeTicks(block.start, block.end, bpPerPx, true, false)

    return (
      <div className={classes.block} style={{ width: block.widthPx }}>
        {ticks.map(({ type, base }) => {
          if (type !== 'major') {
            return null
          }
          const x =
            (block.reversed ? block.end - base : base - block.start) / bpPerPx
          return (
            <div key={base} className={classes.tick} style={{ left: x }}>
              <div className={classes.label}>
                {getTickDisplayStr(base + 1, bpPerPx)}
              </div>
            </div>
          )
        })}
      </div>
    )
  },
  (prev, next) =>
    prev.block.key === next.block.key &&
    prev.block.widthPx === next.block.widthPx &&
    prev.bpPerPx === next.bpPerPx,
)

const ScalebarCoordinateLabels = observer(function ScalebarCoordinateLabels({
  model,
}: {
  model: LGV
}) {
  console.log('[ScalebarCoordinateLabels] render')
  const { classes, cx } = useStyles()
  const { staticBlocks, bpPerPx } = model

  return (
    <div style={{ display: 'flex' }}>
      {staticBlocks.map((block, index) => {
        const key = `${block.key}-${index}`
        if (block.type === 'ContentBlock') {
          return (
            <ContentBlockLabels key={key} block={block} bpPerPx={bpPerPx} />
          )
        } else if (block.type === 'ElidedBlock') {
          return (
            <div
              key={key}
              className={cx(classes.block, classes.elidedBlock)}
              style={{ width: block.widthPx }}
            />
          )
        }
        // InterRegionPaddingBlock renders as empty div
        return (
          <div
            key={key}
            className={classes.block}
            style={{ width: block.widthPx }}
          />
        )
      })}
    </div>
  )
})

export default ScalebarCoordinateLabels
