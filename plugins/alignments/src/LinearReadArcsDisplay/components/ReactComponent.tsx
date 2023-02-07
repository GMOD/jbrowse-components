import React from 'react'
import { isAlive } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { LoadingEllipses } from '@jbrowse/core/ui'
import {
  BlockMsg,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// local
import { LinearReadArcsDisplayModel } from '../model'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => {
  const bg = theme.palette.action.disabledBackground
  return {
    loading: {
      paddingLeft: '0.6em',
      backgroundColor: theme.palette.background.default,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 5px, ${bg} 5px, ${bg} 10px)`,
      height: '100%',
      width: '100%',
      pointerEvents: 'none',
      textAlign: 'center',
    },
  }
})

const Arcs = observer(function ({
  model,
}: {
  model: LinearReadArcsDisplayModel
}) {
  const view = getContainingView(model) as LGV
  return (
    <canvas
      data-testid={`Arc-display-${model.drawn}`}
      ref={ref => {
        if (isAlive(model)) {
          model.setRef(ref)
        }
      }}
      style={{
        position: 'absolute',
        left: -view.offsetPx + model.lastDrawnOffsetPx,
        width: view.dynamicBlocks.totalWidthPx,
        height: model.height,
      }}
      width={view.dynamicBlocks.totalWidthPx * 2}
      height={model.height * 2}
    />
  )
})

export default observer(function ({
  model,
}: {
  model: LinearReadArcsDisplayModel
}) {
  const view = getContainingView(model)
  const { classes } = useStyles()
  const err = model.error
  return err ? (
    <BlockMsg
      message={`${err}`}
      severity="error"
      buttonText={'Reload'}
      action={model.reload}
    />
  ) : model.loading ? (
    <div
      className={classes.loading}
      style={{
        width: view.dynamicBlocks.totalWidthPx,
        height: 20,
        position: 'absolute',
        left: Math.max(0, -view.offsetPx),
      }}
    >
      <LoadingEllipses message={model.message} />
    </div>
  ) : (
    <Arcs model={model} />
  )
})
