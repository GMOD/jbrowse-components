export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { makeStyles } = jbrequire('@material-ui/core/styles')

  const AlignmentPolygons = jbrequire(require('./AlignmentPolygons'))
  const Header = jbrequire(require('./Header'))

  const LinearGenomeView = pluginManager.getViewType('LinearGenomeView')
    .ReactComponent

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        overflow: 'hidden',
        background: '#e8e8e8',
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
        gridArea: '1/1',
      },
      content: {
        gridArea: '1/1',
      },
    }
  })

  const BreakpointMarker = observer(function BreakpointMarker({ model }) {
    const classes = useStyles()

    const leftRegion = model.topLGV.displayedRegions[0]
    const leftWidthPx =
      (leftRegion.end - leftRegion.start) / model.topLGV.bpPerPx
    const offset =
      leftWidthPx - model.topLGV.offsetPx + model.topLGV.controlsWidth - 2
    const left = `${offset}px`
    // TODO: draw little feet on the top and bottom of the marker line to show directionality
    return <div className={classes.breakpointMarker} style={{ left }} />
  })

  const BreakpointSplitView = observer(({ model }) => {
    const classes = useStyles()
    const { topLGV, bottomLGV } = model
    return (
      <div className={classes.container}>
        <div className={classes.content}>
          <Header model={model} />
          <div style={{ position: 'relative' }}>
            <div className={classes.viewContainer}>
              <LinearGenomeView model={topLGV} />
            </div>
            <div className={classes.viewContainer}>
              <LinearGenomeView model={bottomLGV} />
            </div>
          </div>
        </div>
        <div className={classes.overlay}>
          <AlignmentPolygons
            model={model}
            alignmentChunks={model.layoutMatches}
            className={classes.root}
            data-testid={model.configuration.configId}
          />
        </div>
      </div>
    )
  })
  BreakpointSplitView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return BreakpointSplitView
}
