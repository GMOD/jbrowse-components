import React from 'react'
import { observer } from 'mobx-react'
import { getConf } from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { makeStyles } from '@material-ui/core/styles'
import { getEnv } from 'mobx-state-tree'
import { LinearComparativeViewModel } from '../model'
import Header from './Header'

const useStyles = makeStyles(theme => {
  return {
    root: {
      position: 'relative',
      marginBottom: theme.spacing(1),
      overflow: 'hidden',
    },
    breakpointMarker: {
      position: 'absolute',
      top: 0,
      height: '100%',
      width: '3px',
      background: 'magenta',
    },
    viewContainer: {
      marginTop: '3px',
    },
    container: {
      display: 'grid',
    },
    overlay: {
      zIndex: 100,
      gridArea: '1/1',
    },
    content: {
      gridArea: '1/1',
    },
  }
})

interface Props {
  model: LinearComparativeViewModel
}
const Overlays = observer(({ model }: Props) => {
  const classes = useStyles()
  return (
    <>
      {model.tracks.map(track => {
        const [display] = track.displays
        const { RenderingComponent } = display
        return RenderingComponent ? (
          <div
            className={classes.overlay}
            key={getConf(track, 'trackId')}
            style={{ height: display.height }}
          >
            <RenderingComponent model={display} />
          </div>
        ) : null
      })}
    </>
  )
})

// The comparative is in the middle of the views
const MiddleComparativeView = observer(({ model }: Props) => {
  const classes = useStyles()
  const { views } = model
  const { pluginManager } = getEnv(model)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewType = pluginManager.getViewType(views[0].type) as any
  const { ReactComponent } = viewType

  return (
    <div>
      <Header model={model} />
      <div className={classes.container}>
        <ReactComponent model={views[0]} />
        <div style={{ display: 'grid' }}>
          <Overlays model={model} />
        </div>
        <ReactComponent model={views[1]} />
      </div>
    </div>
  )
})
const OverlayComparativeView = observer(({ model }: Props) => {
  const classes = useStyles()
  const { views } = model
  const { pluginManager } = getEnv(model)
  return (
    <div>
      <Header model={model} />
      <div className={classes.container}>
        <div className={classes.content}>
          <div style={{ position: 'relative' }}>
            {views.map(view => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const viewType = pluginManager.getViewType(view.type) as any
              const { ReactComponent } = viewType
              return <ReactComponent key={view.id} model={view} />
            })}
          </div>
          <Overlays model={model} />
        </div>
      </div>
    </div>
  )
})

const LinearComparativeView = observer(({ model }: Props) => {
  const middle = model.tracks.some(t =>
    t.displays.some((d: AnyConfigurationModel) => getConf(d, 'middle')),
  )
  return middle ? (
    <MiddleComparativeView model={model} />
  ) : (
    <OverlayComparativeView model={model} />
  )
})

export default LinearComparativeView
