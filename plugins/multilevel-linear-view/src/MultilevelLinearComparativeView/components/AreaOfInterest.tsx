import React from 'react'
import { observer } from 'mobx-react'
import { Typography } from '@material-ui/core'
import { makeStyles, useTheme, alpha } from '@material-ui/core/styles'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'

import { MultilevelLinearComparativeViewModel } from '../model'

type LCV = MultilevelLinearComparativeViewModel
type LGV = LinearGenomeViewModel

const useStyles = makeStyles(() => {
  return {
    guide: {
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 10,
    },
  }
})

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
    const classes = useStyles()
    const { left, right } = polygonPoints

    const theme = useTheme()
    const { tertiary, primary } = theme.palette
    const polygonColor = tertiary ? tertiary.light : primary.light

    const width = !isNaN(right) ? right - left : 0

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
    return (
      <>
        <div
          className={classes.guide}
          style={{
            left,
            width,
            height,
            background: alpha(polygonColor, 0.3),
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
          {model.views[model.anchorViewIndex].displayName}
        </Typography>
      </>
    )
  },
)

export default AreaOfInterest
