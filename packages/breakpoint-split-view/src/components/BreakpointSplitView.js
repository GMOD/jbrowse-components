const dragHandleHeight = 3

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
export default pluginManager => {
  const { jbrequire } = pluginManager
  const { getRoot } = jbrequire('mobx-state-tree')
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { Icon, IconButton } = jbrequire('@material-ui/core')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const ResizeHandle = jbrequire('@gmod/jbrowse-core/components/ResizeHandle')
  const { assembleLocString } = jbrequire('@gmod/jbrowse-core/util')

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
    }
  })
  function transform(view, coord) {
    return coord / view.bpPerPx - view.offsetPx + 120
  }
  const AlignmentInfo = observer(
    ({ model, alignmentChunks, height, children }) => {
      const { topLGV, bottomLGV } = model
      return (
        <div style={{ position: 'relative' }}>
          {children}
          <svg
            height="100%"
            width="100%"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            {Object.values(alignmentChunks).map(chunk => {
              const [c1, c2] = chunk
              const f1 = transform(topLGV, c1[0])
              const f2 = transform(topLGV, c1[2])
              const f3 = transform(bottomLGV, c2[0])
              const f4 = transform(bottomLGV, c2[2])

              const h1 = c1[3] + topLGV.headerSize
              const h2 = topLGV.height + bottomLGV.headerSize + c2[1]
              return (
                <polygon
                  key={JSON.stringify(chunk)}
                  points={`${f1},${h1} ${f2},${h1} ${f4},${h2} ${f3},${h2} `}
                  style={{
                    fill: 'rgba(255,0,0,0.5)',
                  }}
                />
              )
            })}
          </svg>
        </div>
      )
    },
  )

  function BreakpointSplitView({ model }) {
    const classes = useStyles()
    const { topLGV, bottomLGV } = model

    const t1 = topLGV.tracks[0] || {}
    const t2 = bottomLGV.tracks[0] || {}
    const features1 = t1.features || []
    const features2 = t2.features || []
    const layoutFeats1 = t1.layoutFeatures || []
    const layoutFeats2 = t2.layoutFeatures || []
    const matches = findMatches(features1, features2)
    console.log(t1, t2, features1, features2, matches)
    const layoutMatches = new Map()
    for (const [key, elt] of Object.entries(matches)) {
      const f1 = layoutFeats1.get(elt[0].id())
      const f2 = layoutFeats2.get(elt[1].id())
      layoutMatches[key] = [f1, f2]
    }

    return (
      <AlignmentInfo
        model={model}
        alignmentChunks={layoutMatches}
        className={classes.root}
        data-testid={model.configuration.configId}
      >
        <Header model={model} />
        <LinearGenomeView model={topLGV} />
        <LinearGenomeView model={bottomLGV} />
      </AlignmentInfo>
    )
  }
  BreakpointSplitView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(BreakpointSplitView)
}
