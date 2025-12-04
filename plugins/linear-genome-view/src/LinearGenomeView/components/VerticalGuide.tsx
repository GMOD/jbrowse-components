import { stringify } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
    left: 0,
    background: 'red',
    zIndex: 1001,
  },
  tooltipTarget: {
    position: 'sticky',
    left: 0,
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
  const { stickyViewHeaders, rubberbandTop } = model

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
          style={{
            transform: `translateX(${coordX + 6}px)`,
            top: rubberbandTop,
            position: stickyViewHeaders ? 'sticky' : undefined,
          }}
        />
      </Tooltip>
      <div
        className={classes.guide}
        style={{ transform: `translateX(${coordX}px)` }}
      />
    </>
  )
})

export default VerticalGuide
