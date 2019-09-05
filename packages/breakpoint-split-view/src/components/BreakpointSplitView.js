const dragHandleHeight = 3

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

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        overflow: 'hidden',
        background: 'white',
      },
    }
  })

  function BreakpointSplitView({ model }) {
    const classes = useStyles()

    return (
      <div
        className={classes.root}
        style={{ height: `${model.height}px` }}
        data-testid={model.configuration.configId}
      >
        <Header model={model} />
        <b>Hi breakend viewer</b>
        <ResizeHandle
          onDrag={model.resizeHeight}
          objectId={model.id}
          style={{
            height: dragHandleHeight,
            position: 'absolute',
            bottom: 0,
            left: 0,
            background: '#ccc',
            boxSizing: 'border-box',
            borderTop: '1px solid #fafafa',
          }}
        />
      </div>
    )
  }
  BreakpointSplitView.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(BreakpointSplitView)
}
