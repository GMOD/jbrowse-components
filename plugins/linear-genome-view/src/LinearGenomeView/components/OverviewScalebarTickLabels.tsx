import { getSession, getTickDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { HEADER_OVERVIEW_HEIGHT } from '../consts.ts'
import { chooseGridPitch } from '../util.ts'

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
    const { majorPitch } = chooseGridPitch(overviewScale, 120, 15)
    const { assemblyManager } = getSession(model)
    const assembly = assemblyManager.get(assemblyName)
    const refNameColor = assembly?.getRefNameColor(refName)

    const numTicks = Math.floor((end - start) / majorPitch)
    return Array.from({ length: numTicks }, (_, i) => {
      const tickNum = i + 1
      // Pixel position is the same regardless of strand; genomicCoord only
      // affects the displayed label text.
      const genomicCoord = reversed
        ? end - tickNum * majorPitch
        : start + tickNum * majorPitch
      return (
        <Typography
          key={genomicCoord}
          className={classes.scalebarLabel}
          variant="body2"
          style={{
            transform: `translateX(${(tickNum * majorPitch) / overviewScale}px)`,
            color: refNameColor,
          }}
        >
          {getTickDisplayStr(genomicCoord, overviewLayout.bpPerPx)}
        </Typography>
      )
    })
  },
)

export default OverviewScalebarTickLabels
