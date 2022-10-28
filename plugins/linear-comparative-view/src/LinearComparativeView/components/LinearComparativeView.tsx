import React from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getConf, AnyConfigurationModel } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { ResizeHandle } from '@jbrowse/core/ui'

// locals
import { LinearComparativeViewModel } from '../model'
import RubberBand from './RubberBand'
import Header from './Header'

const useStyles = makeStyles()(() => ({
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

  // this helps keep the vertical guide inside the parent view container,
  // similar style exists in the single LGV's trackscontainer
  rubberbandContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
}))

type LCV = LinearComparativeViewModel

const Overlays = observer(({ model }: { model: LCV }) => {
  const { classes } = useStyles()
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
    const { classes } = useStyles()
    const { views } = model
    const { pluginManager } = getEnv(model)
    const { ReactComponent } = pluginManager.getViewType(views[0].type)

    return (
      <div className={classes.rubberbandContainer}>
        <Header ExtraButtons={ExtraButtons} model={model} />
        <RubberBand
          model={model}
          ControlComponent={<div style={{ width: '100%', height: 15 }} />}
        />
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
const OverlayComparativeView = observer(
  ({ model, ExtraButtons }: { ExtraButtons?: React.ReactNode; model: LCV }) => {
    const { classes } = useStyles()
    const { views } = model
    const { pluginManager } = getEnv(model)
    return (
      <div className={classes.rubberbandContainer}>
        <Header model={model} ExtraButtons={ExtraButtons} />
        <RubberBand
          model={model}
          ControlComponent={<div style={{ width: '100%', height: 15 }} />}
        />

        <div className={classes.container}>
          <div className={classes.content}>
            <div className={classes.relative}>
              {views.map(view => {
                const { ReactComponent } = pluginManager.getViewType(view.type)
                return <ReactComponent key={view.id} model={view} />
              })}
            </div>
            <Overlays model={model} />
          </div>
        </div>
      </div>
    )
  },
)

const LinearComparativeView = observer(
  (props: { ExtraButtons?: React.ReactNode; model: LCV }) => {
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

export default LinearComparativeView
