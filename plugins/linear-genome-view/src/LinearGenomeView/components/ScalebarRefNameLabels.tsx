import React from 'react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  refLabel: {
    fontSize: 11,
    position: 'absolute',
    left: 2,
    top: -1,
    fontWeight: 'bold',
    lineHeight: 'normal',
    zIndex: 1,
    background: theme.palette.background.paper,
  },
  b0: {
    left: 0,
    zIndex: 100,
  },
}))

const ScalebarRefNameLabels = observer(function ({ model }: { model: LGV }) {
  const { classes, cx } = useStyles()
  const { staticBlocks, offsetPx, scaleBarDisplayPrefix } = model

  // find the block that needs pinning to the left side for context
  let lastLeftBlock = 0
  staticBlocks.forEach((block, i) => {
    if (block.offsetPx - offsetPx < 0) {
      lastLeftBlock = i
    }
  })
  const val = scaleBarDisplayPrefix()
  const b0 = staticBlocks.blocks[0]
  return (
    <>
      {b0?.type !== 'ContentBlock' && val ? (
        <Typography className={cx(classes.b0, classes.refLabel)}>
          {val}
        </Typography>
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
          <Typography
            key={`refLabel-${key}-${index}`}
            style={{
              left: last
                ? Math.max(0, -offsetPx)
                : blockOffsetPx - offsetPx - 1,
              paddingLeft: last ? 0 : 1,
            }}
            className={classes.refLabel}
            data-testid={`refLabel-${refName}`}
          >
            {last && val ? `${val}:` : ''}
            {refName}
          </Typography>
        ) : null
      })}
    </>
  )
})

export default ScalebarRefNameLabels
