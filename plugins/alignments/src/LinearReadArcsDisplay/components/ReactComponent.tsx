import React from 'react'
import { isAlive } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getContainingView } from '@jbrowse/core/util'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// local
import { LinearReadArcsDisplayModel } from '../model'

type LGV = LinearGenomeViewModel

const height = 1200

const useStyles = makeStyles()(theme => ({
  loading: {
    paddingLeft: '0.6em',
    backgroundColor: theme.palette.action.disabledBackground,
    backgroundImage:
      'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,.5) 5px, rgba(255,255,255,.5) 10px)',
    height: '100%',
    width: '100%',
    pointerEvents: 'none',
    textAlign: 'center',
  },
}))

const Arcs = observer(function ({
  model,
}: {
  model: LinearReadArcsDisplayModel
}) {
  const view = getContainingView(model) as LGV
  return (
    <canvas
      ref={ref => {
        if (isAlive(model)) {
          model.setRef(ref)
        }
      }}
      style={{
        position: 'absolute',
        left: -view.offsetPx + model.lastDrawnOffsetPx,
        width: view.dynamicBlocks.totalWidthPx,
      }}
      width={view.dynamicBlocks.totalWidthPx * 2}
      height={height * 2}
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
  return model.error ? (
    <ErrorMessage error={model.error} />
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
