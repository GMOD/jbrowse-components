import React from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { makeStyles } from '@material-ui/core/styles'
import { bpToPx } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'

import { MultilevelLinearComparativeViewModel } from '../model'
import AreaOfInterest from './AreaOfInterest'
import Subheader from './Subheader'
import MiniControls from './MiniControls'
import Header from './Header'

const useStyles = makeStyles(() => ({
  container: {
    display: 'grid',
  },
  overlay: {
    zIndex: 100,
    gridArea: '1/1',
  },
  content: {
    gridArea: '1/1',
    position: 'relative',
  },
  grid: {
    display: 'grid',
  },
  relative: {
    position: 'relative',
  },
}))

type LCV = MultilevelLinearComparativeViewModel
type LGV = LinearGenomeViewModel

const getLeft = (model: LCV, view: LGV) => {
  const coordA = bpToPx(
    model.views[model.anchorViewIndex].coarseDynamicBlocks[0]?.start,
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

  return left
}

const getRight = (model: LCV, view: LGV) => {
  const coordB = bpToPx(
    model.views[model.anchorViewIndex].coarseDynamicBlocks[0]?.end,
    {
      start: view.coarseDynamicBlocks[0]?.start,
      end: view.coarseDynamicBlocks[0]?.end,
      reversed: view.coarseDynamicBlocks[0]?.reversed,
    },
    view.bpPerPx,
  )
  const right = !isNaN(coordB)
    ? view.offsetPx < 0
      ? coordB + view.offsetPx * -1
      : coordB
    : 0

  return right
}

const OverlayComparativeView = observer(
  ({ model, ExtraButtons }: { model: LCV; ExtraButtons?: React.ReactNode }) => {
    const classes = useStyles()
    const { views } = model
    const { pluginManager } = getEnv(model)

    return (
      <div>
        <Header model={model} ExtraButtons={ExtraButtons} />
        <div className={classes.container}>
          <div className={classes.content}>
            <div className={classes.relative}>
              {views.map(view => {
                const { ReactComponent } = pluginManager.getViewType(view.type)

                if (!model.initialized || !view.initialized) {
                  return null
                }

                const left = getLeft(model, view)
                const right = getRight(model, view)

                let index = model.views.findIndex(
                  target => target.id === view.id,
                )
                if (index > 0) {
                  index--
                }
                const targetView = model.views[index]

                const prevLeft = getLeft(model, targetView)
                const prevRight = getRight(model, targetView)

                const polygonPoints = {
                  left,
                  right,
                  prevLeft,
                  prevRight,
                }

                return (
                  <div key={view.id}>
                    <>
                      {!view.hideHeader ? (
                        <Subheader
                          view={view}
                          model={model}
                          polygonPoints={polygonPoints}
                        />
                      ) : null}
                      {model.views[model.anchorViewIndex].id !== view.id &&
                      view.isVisible ? (
                        <AreaOfInterest
                          view={view}
                          model={model}
                          polygonPoints={polygonPoints}
                        />
                      ) : null}
                    </>
                    {view.isVisible ? (
                      <>
                        {view.hasCustomMiniControls ? (
                          <MiniControls model={view} />
                        ) : null}
                        <ReactComponent key={view.id} model={view} />
                      </>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  },
)

const MultilevelLinearComparativeView = observer(
  (props: { model: LCV; ExtraButtons?: React.ReactNode }) => {
    return <OverlayComparativeView {...props} />
  },
)

export default MultilevelLinearComparativeView
