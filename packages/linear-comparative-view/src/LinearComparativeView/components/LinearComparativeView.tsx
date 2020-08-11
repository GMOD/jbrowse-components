import React, { useRef } from 'react'
import { observer } from 'mobx-react'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import { makeStyles } from '@material-ui/core/styles'
import useComponentSize from '@rehooks/component-size'
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
      display: 'flex',
      width: '100%',
      gridArea: '1/1',
      zIndex: 100,
      pointerEvents: 'none',
      '& path': {
        cursor: 'crosshair',
        fill: 'none',
      },
    },
    content: {
      gridArea: '1/1',
    },
  }
})

const Overlays = observer(
  ({ model }: { model: LinearComparativeViewModel }) => (
    <>
      {model.tracks.map(track => {
        const { ReactComponent } = track

        return ReactComponent ? (
          <ReactComponent key={getConf(track, 'trackId')} model={track} />
        ) : null
      })}
    </>
  ),
)

// The comparative is in the middle of the views
const MiddleComparativeView = observer(
  ({ model }: { model: LinearComparativeViewModel }) => {
    const classes = useStyles()
    const { views } = model
    const { pluginManager } = getSession(model)
    const { ReactComponent } = pluginManager.getViewType(views[0].type)
    model.setHeight(100)
    return (
      <div>
        <Header model={model} />
        <div className={classes.container}>
          <div className={classes.content}>
            <div style={{ position: 'relative' }}>
              <div className={classes.viewContainer}>
                <ReactComponent model={views[0]} />
              </div>
              <div style={{ display: 'flex' }}>
                <Overlays model={model} />
              </div>
              <div className={classes.viewContainer}>
                <ReactComponent model={views[1]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
)
const OverlayComparativeView = observer(
  ({ model }: { model: LinearComparativeViewModel }) => {
    const classes = useStyles()
    const { views } = model
    const { pluginManager } = getSession(model)
    const ref = useRef(null)
    const size = useComponentSize(ref)
    model.setHeight(size.height - 20)
    return (
      <div>
        <Header model={model} />
        <div className={classes.container} ref={ref}>
          <div className={classes.content}>
            <div style={{ position: 'relative' }}>
              {views.map(view => {
                const { ReactComponent } = pluginManager.getViewType(view.type)
                return (
                  <div key={view.id} className={classes.viewContainer}>
                    <ReactComponent model={view} />
                  </div>
                )
              })}
            </div>
          </div>
          <div className={classes.overlay}>
            <Overlays model={model} />
          </div>
        </div>
      </div>
    )
  },
)

const LinearComparativeView = observer(
  ({ model }: { model: LinearComparativeViewModel }) => {
    const middle = model.tracks.some(t => getConf(t, 'middle'))
    return middle ? (
      <MiddleComparativeView model={model} />
    ) : (
      <OverlayComparativeView model={model} />
    )
  },
)

export default LinearComparativeView
