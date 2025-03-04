import { getTickDisplayStr } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// core
import { HEADER_OVERVIEW_HEIGHT } from '../consts'
import { chooseGridPitch } from '../util'

import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

const useStyles = makeStyles()({
  scalebarLabel: {
    height: HEADER_OVERVIEW_HEIGHT,
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
})

const OverviewScalebarTickLabels = observer(function ({
  block,
  scale,
  overview,
}: {
  scale: number
  block: ContentBlock
  overview: Base1DViewModel
}) {
  const { classes } = useStyles()
  const { start, end, reversed } = block
  const { majorPitch } = chooseGridPitch(scale, 120, 15)

  const tickLabels = []
  for (let i = 0; i < Math.floor((end - start) / majorPitch); i++) {
    const offsetLabel = (i + 1) * majorPitch
    tickLabels.push(reversed ? end - offsetLabel : start + offsetLabel)
  }
  return tickLabels.map((tickLabel, labelIdx) => (
    <Typography
      key={`${JSON.stringify(block)}-${tickLabel}-${labelIdx}`}
      className={classes.scalebarLabel}
      variant="body2"
      style={{
        left: ((labelIdx + 1) * majorPitch) / scale,
        pointerEvents: 'none',
      }}
    >
      {getTickDisplayStr(tickLabel, overview.bpPerPx)}
    </Typography>
  ))
})

export default OverviewScalebarTickLabels
