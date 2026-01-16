import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  // Base styles for ref name labels (chromosome names in scalebar)
  // Uses --offset-px CSS variable from parent Scalebar component
  refLabel: {
    fontSize: 11,
    position: 'absolute',
    left: 2,
    top: -1,
    fontWeight: 'bold',
    lineHeight: 'normal',
    zIndex: 1,
    background: theme.palette.background.paper,
    cursor: 'pointer',
    '&:hover': {
      background: theme.palette.grey[300],
    },
  },
  // First block label when it's not a ContentBlock
  b0: {
    left: 0,
    zIndex: 100,
  },
}))

const ScalebarRefNameLabels = observer(function ScalebarRefNameLabels({
  model,
}: {
  model: LGV
}) {
  const { classes, cx } = useStyles()
  const { staticBlocks, offsetPx, scalebarDisplayPrefix } = model

  // find the block that needs pinning to the left side for context
  // default to first ContentBlock if nothing is scrolled left
  let lastLeftBlock = staticBlocks.blocks.findIndex(
    b => b.type === 'ContentBlock',
  )
  if (lastLeftBlock < 0) {
    lastLeftBlock = 0
  }

  // eslint-disable-next-line unicorn/no-array-for-each
  staticBlocks.forEach((block, i) => {
    if (block.type === 'ContentBlock' && block.offsetPx - offsetPx < 0) {
      lastLeftBlock = i
    }
  })
  const val = scalebarDisplayPrefix()
  const b0 = staticBlocks.blocks[0]
  return (
    <>
      {b0?.type !== 'ContentBlock' && val ? (
        <span
          className={cx(classes.b0, classes.refLabel)}
          onMouseDown={event => event.stopPropagation()}
        >
          {val}
        </span>
      ) : null}
      {staticBlocks.map((block, index) => {
        const {
          offsetPx: blockOffsetPx,
          isLeftEndOfDisplayedRegion,
          key,
          type,
          refName,
        } = block
        const last = index === lastLeftBlock
        return type === 'ContentBlock' &&
          (isLeftEndOfDisplayedRegion || last) ? (
          <span
            key={`refLabel-${key}-${index}`}
            style={{
              left: last
                ? 'max(0px, calc(-1 * var(--offset-px)))'
                : `calc(${blockOffsetPx}px - var(--offset-px) - 1px)`,
              paddingLeft: last ? 0 : 1,
            }}
            className={classes.refLabel}
            data-testid={`refLabel-${refName}`}
            onMouseDown={event => event.stopPropagation()}
          >
            {last && val ? `${val}:` : ''}
            {refName}
          </span>
        ) : null
      })}
    </>
  )
})

export default ScalebarRefNameLabels
