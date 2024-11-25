import React from 'react'
import { stringify } from '@jbrowse/core/util'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
    zIndex: 10,
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
  return (
    <Tooltip open placement="top" title={stringify(model.pxToBp(coordX))} arrow>
      <div
        className={classes.guide}
        style={{
          left: coordX,
          background: 'red',
        }}
      />
    </Tooltip>
  )
})

export default VerticalGuide
