import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'
import {
  TICK_LABEL_FONT_SIZE,
  makeOverviewTickLabels,
  overviewRefNameLabelWidth,
} from '../util.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

const useStyles = makeStyles()({
  scalebarLabel: {
    height: HEADER_OVERVIEW_HEIGHT,
    position: 'absolute',
    left: 0,
    display: 'flex',
    // 11px, not body2: makeOverviewTickLabels drops labels too wide for their
    // block using tickLabelWidth, which measures at 11px
    fontSize: TICK_LABEL_FONT_SIZE,
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
    const { refName } = block
    const { bpPerPx } = model.overviewLayout
    return makeOverviewTickLabels({
      block,
      bpPerPx,
      // the bold refName label pinned at the block's left edge takes precedence
      refNameLabelPx: showRefName ? overviewRefNameLabelWidth(refName) : 0,
    }).map(({ genomicCoord, offsetPx, label }) => (
      <Typography
        key={genomicCoord}
        className={classes.scalebarLabel}
        style={{
          transform: `translateX(${offsetPx}px)`,
          color: refNameColor,
        }}
      >
        {label}
      </Typography>
    ))
  },
)

export default OverviewScalebarTickLabels
