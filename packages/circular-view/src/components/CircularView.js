export default ({ jbrequire }) => {
  const { observer, PropTypes } = jbrequire('mobx-react')
  const ReactPropTypes = jbrequire('prop-types')
  const React = jbrequire('react')
  const { withStyles } = jbrequire('@material-ui/core')

  const styles = theme => ({
    root: {
      position: 'relative',
      marginBottom: theme.spacing.unit,
      overflow: 'hidden',
    },
    CircularView: {
      background: '#eee',
      // background: theme.palette.background.paper,
      boxSizing: 'content-box',
    },
    controls: {
      borderRight: '1px solid gray',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    viewControls: {
      height: '100%',
      borderBottom: '1px solid #9e9e9e',
      boxSizing: 'border-box',
    },
    trackControls: {
      whiteSpace: 'normal',
    },
    zoomControls: {
      position: 'absolute',
      top: '0px',
    },
    iconButton: {
      padding: theme.spacing.unit / 2,
    },
  })

  function CircularView(props) {
    const { classes, model } = props
    // const rootModel = getRoot(model)
    // const { id } = model
    // console.log(style)
    return <div className={classes.root}>hi this is a circular view</div>
  }
  CircularView.propTypes = {
    classes: ReactPropTypes.objectOf(ReactPropTypes.string).isRequired,
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  return withStyles(styles)(observer(CircularView))
}
