import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { MultilevelLinearComparativeViewModel } from '../model'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'
import { bpToPx } from '@jbrowse/core/util'
import { Typography } from '@material-ui/core'

type LCV = MultilevelLinearComparativeViewModel
type LGV = LinearGenomeViewModel

const useStyles = makeStyles(theme => {
  return {
    guide: {
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 10,
    },
  }
})

const AreaOfInterest = observer(
  ({ model, view }: { model: LCV; view: LGV }) => {
    const classes = useStyles()

    const coordA = bpToPx(
      model.views[0].coarseDynamicBlocks[0]?.start,
      {
        start: view.coarseDynamicBlocks[0]?.start,
        end: view.coarseDynamicBlocks[0]?.end,
        reversed: view.coarseDynamicBlocks[0]?.reversed,
      },
      view.bpPerPx,
    )
    const coordB = bpToPx(
      model.views[0].coarseDynamicBlocks[0]?.end,
      {
        start: view.coarseDynamicBlocks[0]?.start,
        end: view.coarseDynamicBlocks[0]?.end,
        reversed: view.coarseDynamicBlocks[0]?.reversed,
      },
      view.bpPerPx,
    )

    const left = !isNaN(coordA)
      ? view.offsetPx < 0
        ? coordA + view.offsetPx * -1
        : coordA
      : 0
    const width = !isNaN(coordB) ? coordB - coordA : 0
    const height =
      view.height + view.tracks.length * 25 + (view.tracks.length - 1) * 5

    return (
      <>
        <div
          className={classes.guide}
          style={{
            left,
            width,
            height,
            background: 'rgba(255, 0, 0, 0.2)',
          }}
        />
        <Typography
          className={classes.guide}
          variant="caption"
          style={{ paddingLeft: '1px', left, height, width, color: 'red' }}
        >
          {model.views[0].displayName}
        </Typography>
      </>
    )
  },
)

export default AreaOfInterest
