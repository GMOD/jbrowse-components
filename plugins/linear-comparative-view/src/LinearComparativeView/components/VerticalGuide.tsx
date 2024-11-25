import React from 'react'
import { stringify } from '@jbrowse/core/util'
import { Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { LinearComparativeViewModel } from '../model'

type LCV = LinearComparativeViewModel

const useStyles = makeStyles()({
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
    zIndex: 10,
  },
  sm: {
    fontSize: 10,
  },
})

const VerticalGuide = observer(function ({
  model,
  coordX,
}: {
  model: LCV
  coordX: number
}) {
  const { classes } = useStyles()
  return (
    <Tooltip
      open
      placement="top"
      title={model.views
        .map(view => view.pxToBp(coordX))
        .map((elt, idx) => (
          <Typography
            className={classes.sm}
            key={[JSON.stringify(elt), idx].join('-')}
          >
            {stringify(elt, true)}
          </Typography>
        ))}
      arrow
    >
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
