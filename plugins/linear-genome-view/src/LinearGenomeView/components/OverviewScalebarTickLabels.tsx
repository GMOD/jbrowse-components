import { getTickDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'
import { makeOverviewTicks, overviewRefNameLabelWidth } from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

const useStyles = makeStyles()({
  scalebarLabel: {
    height: HEADER_OVERVIEW_HEIGHT,
    position: 'absolute',
    left: 0,
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
})

const OverviewScalebarTickLabels = observer(
  function OverviewScalebarTickLabels({
    block,
    model,
    refNameColor,
    showRefName,
  }: {
    model: LinearGenomeViewModel
    block: ContentBlock
    refNameColor: string | undefined
    showRefName: boolean
  }) {
    const { classes } = useStyles()
    const { start, end, reversed, refName } = block
    const { overviewLayout } = model
    const { bpPerPx } = overviewLayout
    const ticks = makeOverviewTicks(start, end, bpPerPx, reversed)

    // skip ticks that would collide with the bold refName label pinned at the
    // block's left edge
    const reservedPx = showRefName ? overviewRefNameLabelWidth(refName) : 0
    return ticks
      .filter(({ offsetPx }) => offsetPx >= reservedPx)
      .map(({ genomicCoord, offsetPx }) => (
        <Typography
          key={genomicCoord}
          className={classes.scalebarLabel}
          variant="body2"
          style={{
            transform: `translateX(${offsetPx}px)`,
            color: refNameColor,
          }}
        >
          {getTickDisplayStr(genomicCoord, bpPerPx)}
        </Typography>
      ))
  },
)

export default OverviewScalebarTickLabels
