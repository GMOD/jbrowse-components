import { stringify } from '@jbrowse/core/util'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
    background: 'red',
    zIndex: 1001,
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
            left: coordX + 6,
            top: rubberbandTop,
            position: stickyViewHeaders ? 'sticky' : undefined,
          }}
        />
      </Tooltip>
      <div className={classes.guide} style={{ left: coordX }} />
    </>
  )
})

export default VerticalGuide
