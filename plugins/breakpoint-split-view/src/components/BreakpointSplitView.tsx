import { makeStyles } from '@material-ui/core/styles'
import { BreakpointViewModel, VIEW_DIVIDER_HEIGHT } from '../model'
import AlignmentConnectionsFactory from './AlignmentConnections'
import BreakendsFactory from './Breakends'
import HeaderFactory from './Header'
import TranslocationsFactory from './Translocations'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useRef } = React
  const { makeStyles: jbrequiredMakeStyles } = jbrequire(
    '@material-ui/core/styles',
  )

  const AlignmentConnections = jbrequire(AlignmentConnectionsFactory)
  const Breakends = jbrequire(BreakendsFactory)
  const Translocations = jbrequire(TranslocationsFactory)

  const Header = jbrequire(HeaderFactory)

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
      if (
        tracks[0].type === 'PileupTrack' ||
        tracks[0].type === 'AlignmentsTrack'
      ) {
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
      const ref = useRef(null)

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
                ref={ref}
                style={{
                  width: '100%',
                  zIndex: 10,
                  pointerEvents: model.interactToggled ? undefined : 'none',
                }}
              >
                {model.matchedTracks.map(id => {
                  // note: we must pass ref down, because the child component
                  // needs to getBoundingClientRect on the this components SVG,
                  // and we cannot rely on using getBoundingClientRect in this
                  // component to make sure this works because if it gets
                  // shifted around by another element, this will not re-render
                  // necessarily
                  return (
                    <Overlay
                      parentRef={ref}
                      key={id}
                      model={model}
                      trackConfigId={id}
                    />
                  )
                })}
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
