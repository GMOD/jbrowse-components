import React from 'react'
import { Tooltip } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { stringify } from '@jbrowse/core/util'

// locals
import { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  guide: {
    height: '100%',
    pointerEvents: 'none',
    position: 'absolute',
    width: 1,
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
          background: 'red',
          left: coordX,
        }}
      />
    </Tooltip>
  )
})

export default VerticalGuide
