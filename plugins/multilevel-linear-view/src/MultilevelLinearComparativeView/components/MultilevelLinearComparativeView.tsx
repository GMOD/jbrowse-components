import React from 'react'
import { observer } from 'mobx-react'
import { getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { makeStyles } from '@material-ui/core/styles'
import { getEnv } from 'mobx-state-tree'
import { ResizeHandle } from '@jbrowse/core/ui'
import { MultilevelLinearComparativeViewModel } from '../model'
import Header from './Header'
import MiniControls from './MiniControls'
import Subheader from './Subheader'
import AreaOfInterest from './AreaOfInterest'
import { bpToPx } from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'

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

const Overlays = observer(({ model }: { model: LCV }) => {
  const classes = useStyles()
  return (
    <>
      {model.tracks.map(track => {
        const [display] = track.displays
        const { RenderingComponent } = display
        const trackId = getConf(track, 'trackId')
        return RenderingComponent ? (
          <div
            className={classes.overlay}
            key={trackId}
            style={{
              height: model.middleComparativeHeight,
              overflow: 'hidden',
            }}
          >
            <RenderingComponent model={display} />
          </div>
        ) : null
      })}
    </>
  )
})

// The comparative is in the middle of the views
const MiddleComparativeView = observer(
  ({ model, ExtraButtons }: { ExtraButtons?: React.ReactNode; model: LCV }) => {
    const classes = useStyles()
    const { views } = model
    const { ReactComponent } = getEnv(model).pluginManager.getViewType(
      views[0].type,
    )

    return (
      <div>
        <Header ExtraButtons={ExtraButtons} model={model} />
        <div className={classes.container}>
          <ReactComponent model={views[0]} />
          <div className={classes.grid}>
            <Overlays model={model} />
          </div>
          <ResizeHandle
            onDrag={n =>
              model.setMiddleComparativeHeight(
                model.middleComparativeHeight + n,
              )
            }
            style={{
              height: 4,
              background: '#ccc',
            }}
          />
          <ReactComponent model={views[1]} />
        </div>
      </div>
    )
  },
)

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
        {!model.views[model.anchorViewIndex].hideHeader ? (
          <Header model={model} ExtraButtons={ExtraButtons} />
        ) : null}
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

                const prevLeft =
                  model.views[model.anchorViewIndex].id !== view.id
                    ? getLeft(model, targetView)
                    : 0
                const prevRight =
                  model.views[model.anchorViewIndex].id !== view.id
                    ? getRight(model, targetView)
                    : 0

                const polygonPoints = {
                  left,
                  right,
                  prevLeft,
                  prevRight,
                }

                return (
                  <div key={view.id}>
                    {model.views[model.anchorViewIndex].id !== view.id ? (
                      <>
                        {!view.hideHeader ? (
                          <Subheader
                            view={view}
                            model={model}
                            polygonPoints={polygonPoints}
                          />
                        ) : null}
                        {view.isVisible ? (
                          <AreaOfInterest
                            view={view}
                            model={model}
                            polygonPoints={polygonPoints}
                          />
                        ) : null}
                      </>
                    ) : null}
                    {view.isVisible ? (
                      <>
                        {view.hasCustomMiniControls &&
                        (view.hideHeader || view.hideControls) ? (
                          <MiniControls model={view} />
                        ) : null}
                        <ReactComponent key={view.id} model={view} />
                      </>
                    ) : null}
                  </div>
                )
              })}
            </div>
            <Overlays model={model} />
          </div>
        </div>
      </div>
    )
  },
)

const MultilevelLinearComparativeView = observer(
  (props: { model: LCV; ExtraButtons?: React.ReactNode }) => {
    const { model } = props
    const middle = model.tracks.some(({ displays }) =>
      displays.some((d: AnyConfigurationModel) => getConf(d, 'middle')),
    )
    return middle ? (
      <MiddleComparativeView {...props} />
    ) : (
      <OverlayComparativeView {...props} />
    )
  },
)

export default MultilevelLinearComparativeView
