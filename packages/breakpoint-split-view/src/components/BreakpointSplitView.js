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

  function findMatches(features1, features2) {
    const candidates = {}
    const matches = {}
    for (const f of features1.values()) {
      candidates[f.get('name')] = f
    }
    for (const f of features2.values()) {
      const name = f.get('name')
      const id = f.id()
      if (
        candidates[name] &&
        candidates[name].id() !== id &&
        Math.abs(candidates[name].get('start') - f.get('start')) > 1000
      ) {
        matches[name] = [candidates[name], f]
      }
    }
    return matches
  }

  const BreakpointSplitView = observer(({ model }) => {
    const classes = useStyles()
    const { topLGV, bottomLGV } = model
    const t1 = topLGV.tracks.length > 0 ? topLGV.tracks[0] : {}
    const t2 = bottomLGV.tracks.length > 0 ? bottomLGV.tracks[0] : {}
    const features1 = t1.features || []
    const features2 = t2.features || []
    const layoutFeats1 = t1.layoutFeatures || []
    const layoutFeats2 = t2.layoutFeatures || []
    const matches = findMatches(features1, features2)
    const layoutMatches = new Map()
    for (const [key, elt] of Object.entries(matches)) {
      const f1 = layoutFeats1.get(elt[0].id())
      const f2 = layoutFeats2.get(elt[1].id())
      layoutMatches[key] = [f1, f2]
    }
    return (
      <AlignmentPolygons
        model={model}
        alignmentChunks={layoutMatches}
        className={classes.root}
        data-testid={model.configuration.configId}
      >
        <Header model={model} />
        <div className={classes.viewContainer}>
          <LinearGenomeView model={topLGV} />
        </div>
        <div className={classes.viewContainer}>
          <LinearGenomeView model={bottomLGV} />
        </div>
        <BreakpointMarker model={model} />
      </AlignmentPolygons>
    )
  })
  BreakpointSplitView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return BreakpointSplitView
}
