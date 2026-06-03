import { getSession, getTickDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'
import { makeOverviewTicks } from '../util.ts'

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
  }: {
    model: LinearGenomeViewModel
    block: ContentBlock
  }) {
    const { classes } = useStyles()
    const { start, end, reversed, refName, assemblyName } = block
    const { overviewScale, overviewLayout } = model
    const { assemblyManager } = getSession(model)
    const assembly = assemblyManager.get(assemblyName)
    const refNameColor = assembly?.getRefNameColor(refName)
    const ticks = makeOverviewTicks(
      start,
      end,
      overviewScale,
      reversed ?? false,
    )
    return ticks.map(({ genomicCoord, offsetPx }) => (
      <Typography
        key={genomicCoord}
        className={classes.scalebarLabel}
        variant="body2"
        style={{
          transform: `translateX(${offsetPx}px)`,
          color: refNameColor,
        }}
      >
        {getTickDisplayStr(genomicCoord, overviewLayout.bpPerPx)}
      </Typography>
    ))
  },
)

export default OverviewScalebarTickLabels
