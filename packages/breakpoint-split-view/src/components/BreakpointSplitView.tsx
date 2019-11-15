import { makeStyles } from '@material-ui/core/styles'
import { Instance } from 'mobx-state-tree'
import { BreakpointViewStateModel } from '../model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (pluginManager: any) => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { makeStyles: jbrequiredMakeStyles } = jbrequire(
    '@material-ui/core/styles',
  )

  const AlignmentSplines = jbrequire(require('./AlignmentSplines'))
  const BreakendLines = jbrequire(require('./BreakendLines'))
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
        gridArea: '1/1',
      },
      content: {
        gridArea: '1/1',
      },
    }
  })

  // const BreakpointMarker = observer(function BreakpointMarker({
  //   model,
  // }: {
  //   model: Instance<BreakpointViewStateModel>
  // }) {
  //   const classes = useStyles()

  //   const leftRegion = model.topLGV.displayedRegions[0]
  //   const leftWidthPx =
  //     (leftRegion.end - leftRegion.start) / model.topLGV.bpPerPx
  //   const offset =
  //     leftWidthPx - model.topLGV.offsetPx + model.topLGV.controlsWidth - 2
  //   const left = `${offset}px`
  //   // TODO: draw little feet on the top and bottom of the marker line to show directionality
  //   return <div className={classes.breakpointMarker} style={{ left }} />
  // })

  const BreakpointSplitView = observer(
    ({ model }: { model: Instance<BreakpointViewStateModel> }) => {
      const classes = useStyles()
      const { views } = model
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
            {model.matchedTracks.map(m => {
              const { features, type } = model.getMatchedFeaturesInLayout(m)
              if (type === 'Alignments') {
                return (
                  <div className={classes.overlay} key={`overlay-${m}`}>
                    <AlignmentSplines
                      trackConfigId={m}
                      model={model}
                      alignmentChunks={features}
                      className={classes.root}
                      data-testid={model.configuration.configId}
                    />
                  </div>
                )
              }
              if (type === 'Breakends') {
                return (
                  <div className={classes.overlay} key={`overlay-${m}`}>
                    <BreakendLines
                      trackConfigId={m}
                      model={model}
                      alignmentChunks={features}
                      className={classes.root}
                      data-testid={model.configuration.configId}
                    />
                  </div>
                )
              }
              if (type === 'Translocations') {
                return (
                  <div className={classes.overlay} key={`overlay-${m}`}>
                    <Translocations
                      trackConfigId={m}
                      model={model}
                      alignmentChunks={features}
                      className={classes.root}
                      data-testid={model.configuration.configId}
                    />
                  </div>
                )
              }
              return null
            })}
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
