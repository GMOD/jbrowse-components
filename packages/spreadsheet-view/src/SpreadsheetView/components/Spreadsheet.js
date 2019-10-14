export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { makeStyles } = jbrequire('@material-ui/core/styles')

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        background: 'white',
      },
    }
  })

  function Spreadsheet({ model }) {
    const classes = useStyles()

    return <div className={classes.root}>hi spreadsheet</div>
  }
  Spreadsheet.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(Spreadsheet)
}
