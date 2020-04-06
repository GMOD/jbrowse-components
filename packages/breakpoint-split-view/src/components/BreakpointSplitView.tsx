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

  const { VIEW_DIVIDER_HEIGHT } = require('../model')
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
      viewDivider: {
        background: theme.palette.secondary.main,
        height: VIEW_DIVIDER_HEIGHT,
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
      if (tracks[0].type === 'PileupTrack') {
        return <AlignmentConnections {...props} />
      }
      if (tracks[0].type === 'VariantTrack') {
        return model.hasTranslocations(trackConfigId) ? (
          <Translocations {...props} />
        ) : (
          <Breakends {...props} />
        )
      }
      return null
    },
  )

  const BreakpointSplitView = observer(
    ({ model }: { model: BreakpointViewModel }) => {
      const classes = useStyles()
      const { views } = model
      return (
        <div>
          <Header model={model} />
          <div className={classes.container}>
            <div className={classes.content}>
              <div style={{ position: 'relative' }}>
                {views.map((view, idx) => {
                  const { ReactComponent } = pluginManager.getViewType(
                    view.type,
                  )
                  const viewComponent = (
                    <ReactComponent key={view.id} model={view} />
                  )
                  if (idx === views.length - 1) {
                    return viewComponent
                  }
                  return [
                    viewComponent,
                    <div
                      key={`${view.id}-divider`}
                      className={classes.viewDivider}
                    />,
                  ]
                })}
              </div>
            </div>
            <div className={classes.overlay}>
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
