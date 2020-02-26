import { Instance } from 'mobx-state-tree'
import { makeStyles } from '@material-ui/core/styles'
import { LinearComparativeViewStateModel } from '../model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { getConf } = jbrequire('@gmod/jbrowse-core/configuration')
  const { makeStyles: jbrequiredMakeStyles } = jbrequire(
    '@material-ui/core/styles',
  )

  const Header = jbrequire(require('./Header'))
  const { grey } = jbrequire('@material-ui/core/colors')

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
        background: grey[300],
      },
      overlay: {
        display: 'flex',
        width: '100%',
        gridArea: '1/1',
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
    ({
      model,
    }: {
      model: Instance<LinearComparativeViewStateModel>
      comparativeGroup: string
    }) => (
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
    ({ model }: { model: Instance<LinearComparativeViewStateModel> }) => {
      const classes = useStyles()
      const { views, controlsWidth } = model
      const { ReactComponent } = pluginManager.getViewType(views[0].type)
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
                  <div style={{ width: controlsWidth, flexShrink: 0 }} />
                  <svg
                    style={{
                      width: '100%',
                    }}
                  >
                    <Overlays model={model} />
                  </svg>
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
    ({ model }: { model: Instance<LinearComparativeViewStateModel> }) => {
      const classes = useStyles()
      const { views, controlsWidth } = model
      return (
        <div>
          <Header model={model} />
          <div className={classes.container}>
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
              <div style={{ width: controlsWidth, flexShrink: 0 }} />
              <svg
                style={{
                  width: '100%',
                  zIndex: 10,
                  pointerEvents: model.interactToggled ? undefined : 'none',
                }}
              >
                <Overlays model={model} />
              </svg>
            </div>
          </div>
        </div>
      )
    },
  )

  const LinearComparativeView = observer(
    ({ model }: { model: Instance<LinearComparativeViewStateModel> }) => {
      return <OverlayComparativeView model={model} />
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
