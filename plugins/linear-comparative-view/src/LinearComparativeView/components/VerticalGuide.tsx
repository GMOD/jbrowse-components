import React from 'react'
import { Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { stringify } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'
import { LinearComparativeViewModel } from '../model'

type LCV = LinearComparativeViewModel

const useStyles = makeStyles()({
  guide: {
    height: '100%',
    pointerEvents: 'none',
    position: 'absolute',
    width: 1,
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
          background: 'red',
          left: coordX,
        }}
      />
    </Tooltip>
  )
})

export default VerticalGuide
