import { makeStyles } from '@material-ui/core/styles'
import { BreakpointViewModel } from '../model'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { makeStyles: jbrequiredMakeStyles } = jbrequire(
    '@material-ui/core/styles',
  )

  const AlignmentConnections = jbrequire(require('./AlignmentConnections'))
  const Breakends = jbrequire(require('./Breakends'))
  const Translocations = jbrequire(require('./Translocations'))

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

  const Overlay = observer(
    (props: { model: BreakpointViewModel; trackConfigId: string }) => {
      const { model, trackConfigId } = props
      const tracks = model.getMatchedTracks(trackConfigId)
      if (tracks[0].type === 'AlignmentsTrack') {
        return <AlignmentConnections {...props} />
      }
      if (tracks[0].type === 'VariantTrack') {
        if (model.hasTranslocations(trackConfigId)) {
          return <Translocations {...props} />
        }
        return <Breakends {...props} />
      }
      return null
    },
  )

  const BreakpointSplitView = observer(
    ({ model }: { model: BreakpointViewModel }) => {
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
                {model.matchedTracks.map(id => (
                  <Overlay key={id} model={model} trackConfigId={id} />
                ))}
              </svg>
            </div>
          </div>
        </div>
      )
    },
  )
  BreakpointSplitView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return BreakpointSplitView
}
