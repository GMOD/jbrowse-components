import { VIEW_HEADER_HEIGHT } from '@jbrowse/core/ui'
import { stringify } from '@jbrowse/core/util'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { HEADER_BAR_HEIGHT, HEADER_OVERVIEW_HEIGHT } from '../consts'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
    background: 'red',
    zIndex: 4,
  },
  tooltipTarget: {
    position: 'sticky',
    width: 1,
  },
})

const VerticalGuide = observer(function VerticalGuide({
  model,
  coordX,
}: {
  model: LGV
  coordX: number
}) {
  const { classes } = useStyles()
  let tooltipTop = VIEW_HEADER_HEIGHT
  if (!model.hideHeader) {
    tooltipTop += HEADER_BAR_HEIGHT
    if (!model.hideHeaderOverview) {
      tooltipTop += HEADER_OVERVIEW_HEIGHT
    }
  }
  return (
    <>
      <Tooltip
        open
        placement="top"
        title={stringify(model.pxToBp(coordX))}
        arrow
      >
        <div
          className={classes.tooltipTarget}
          style={{ left: coordX + 6, top: tooltipTop }}
        />
      </Tooltip>
      <div className={classes.guide} style={{ left: coordX }} />
    </>
  )
})

export default VerticalGuide
