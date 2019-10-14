export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const FormControl = jbrequire('@material-ui/core/FormControl')
  const FormGroup = jbrequire('@material-ui/core/FormGroup')
  const FormLabel = jbrequire('@material-ui/core/FormLabel')

  const FileSelector = jbrequire(require('./FileSelector'))

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        background: 'white',
      },
    }
  })

  function ImportWizard({ model }) {
    const classes = useStyles()

    return (
      <div className={classes.root}>
        <FormControl component="fieldset">
          <FormLabel component="legend">Import spreadsheet from</FormLabel>
          <FormGroup>
            <FileSelector model={model} />
          </FormGroup>
        </FormControl>
      </div>
    )
  }
  ImportWizard.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(ImportWizard)
}
