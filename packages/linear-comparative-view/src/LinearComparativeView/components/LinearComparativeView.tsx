/* eslint-disable @typescript-eslint/no-explicit-any */
import { makeStyles } from '@material-ui/core/styles'
import useComponentSize from '@rehooks/component-size'
import { LinearComparativeViewModel } from '../model'

export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useRef } = jbrequire('react')
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { makeStyles: jbrequiredMakeStyles } = jbrequire(
    '@material-ui/core/styles',
  )

  const Header = jbrequire(require('./Header'))

  const useStyles = (jbrequiredMakeStyles as typeof makeStyles)(theme => {
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
        {model.tracks.map((track: any) => {
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
                  const { ReactComponent } = pluginManager.getViewType(
                    view.type,
                  )
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
      const middle = model.tracks.some((t: any) => getConf(t, 'middle'))
      // const noMiddle = model.tracks.some((t: any) => !getConf(t, 'middle'))
      return middle ? (
        <MiddleComparativeView model={model} />
      ) : (
        <OverlayComparativeView model={model} />
      )
    },
  )

  MiddleComparativeView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  OverlayComparativeView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  LinearComparativeView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return LinearComparativeView
}
