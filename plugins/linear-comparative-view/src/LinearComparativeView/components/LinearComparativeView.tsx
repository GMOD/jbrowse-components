import React from 'react'
import { observer } from 'mobx-react'
import { getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { makeStyles } from '@material-ui/core/styles'
import { getEnv } from 'mobx-state-tree'
import { LinearComparativeViewModel } from '../model'
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

type LCV = LinearComparativeViewModel

const Overlays = observer(({ model }: { model: LCV }) => {
  const classes = useStyles()
  return (
    <>
      {model.tracks.map(track => {
        const [display] = track.displays
        const { height, RenderingComponent } = display
        const trackId = getConf(track, 'trackId')
        return RenderingComponent ? (
          <div className={classes.overlay} key={trackId} style={{ height }}>
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
          <ReactComponent model={views[1]} />
        </div>
      </div>
    )
  },
)
const OverlayComparativeView = observer(
  ({ model, ExtraButtons }: { ExtraButtons?: React.ReactNode; model: LCV }) => {
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
