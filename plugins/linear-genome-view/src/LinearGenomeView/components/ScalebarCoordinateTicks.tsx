import React from 'react'
import { getTickDisplayStr } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// locals
import { ContentBlock as ContentBlockComponent } from '../../BaseLinearDisplay/components/Block'
import { makeTicks } from '../util'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

const useStyles = makeStyles()(theme => ({
  majorTickLabel: {
    fontSize: 11,
    zIndex: 1,
    background: theme.palette.background.paper,
    lineHeight: 'normal',
    pointerEvents: 'none',
  },
  tick: {
    position: 'absolute',
    width: 0,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
}))

const ScalebarCoordinateTicks = function ({
  block,
  bpPerPx,
}: {
  block: ContentBlock
  bpPerPx: number
}) {
  const { classes } = useStyles()
  const { reversed, start, end } = block
  const ticks = makeTicks(start, end, bpPerPx, true, false)

  return (
    <ContentBlockComponent block={block}>
      {ticks.map(({ type, base }) => {
        if (type === 'major') {
          const x = (reversed ? end - base : base - start) / bpPerPx
          const baseNumber = base + 1
          return (
            <div key={base} className={classes.tick} style={{ left: x }}>
              {baseNumber ? (
                <Typography className={classes.majorTickLabel}>
                  {getTickDisplayStr(baseNumber, bpPerPx)}
                </Typography>
              ) : null}
            </div>
          )
        }
        return null
      })}
    </ContentBlockComponent>
  )
}

export default ScalebarCoordinateTicks
