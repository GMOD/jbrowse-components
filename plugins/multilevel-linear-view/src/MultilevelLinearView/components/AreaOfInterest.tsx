import React from 'react'
import { observer } from 'mobx-react'
import { Typography, useTheme, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { LinearGenomeMultilevelViewModel } from '../../LinearGenomeMultilevelView/model'
import { MultilevelLinearViewModel } from '../model'

type LCV = MultilevelLinearViewModel
type LGV = LinearGenomeMultilevelViewModel

const useStyles = makeStyles()(theme => ({
  guide: {
    pointerEvents: 'none',
    position: 'absolute',
    zIndex: 10,
  },
}))

const AreaOfInterest = observer(
  ({
    model,
    view,
    polygonPoints,
  }: {
    model: LCV
    view: LGV
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polygonPoints: any
  }) => {
    const { classes } = useStyles()
    const { left, right } = polygonPoints

    const theme = useTheme()
    // @ts-ignore
    const { tertiary, primary } = theme.palette
    const polygonColor = tertiary ? tertiary.light : primary.light

    const width = Math.max(!isNaN(right) ? right - left : 0, 3)

    const labelOffset =
      view.trackLabels === 'offset' ? view.tracks.length * 25 : 0

    const height =
      view.tracks.length === 0
        ? view.hideHeader
          ? view.height + 55
          : view.height - 12
        : view.hideHeader
        ? view.height + (view.tracks.length - 1) * 4 + labelOffset
        : view.height - 55 - 12 + (view.tracks.length - 1) * 4 + labelOffset

    // @ts-ignore
    const anchorView = model.views.find(view => view.isAnchor)

    return (
      <>
        <div
          className={classes.guide}
          style={{
            left,
            width,
            height,
            background: alpha(polygonColor, 0.2),
          }}
        />
        <Typography
          className={classes.guide}
          variant="caption"
          style={{
            paddingLeft: '1px',
            left,
            height,
            width,
            color: polygonColor,
          }}
        >
          {anchorView?.displayName}
        </Typography>
      </>
    )
  },
)

export default AreaOfInterest
