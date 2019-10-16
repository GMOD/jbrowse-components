export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const FormControl = jbrequire('@material-ui/core/FormControl')
  const FormGroup = jbrequire('@material-ui/core/FormGroup')
  const FormLabel = jbrequire('@material-ui/core/FormLabel')
  const Container = jbrequire('@material-ui/core/Container')
  const Box = jbrequire('@material-ui/core/Box')
  const Button = jbrequire('@material-ui/core/Button')
  const Grid = jbrequire('@material-ui/core/Grid')

  const FileSelector = jbrequire(require('./FileSelector'))

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        padding: theme.spacing(1),
        background: 'white',
      },
    }
  })

  function ImportWizard({ model }) {
    const classes = useStyles()

    return (
      <Container>
        <Grid container spacing={1} direction="column" alignItems="center">
          <Grid item>
            <FormControl component="fieldset">
              <FormLabel component="legend">Open spreadsheet from</FormLabel>
              <FormGroup>
                <FileSelector
                  fileRecord={model.fileSource}
                  onChange={model.setFileSource}
                />
              </FormGroup>
            </FormControl>
          </Grid>
          <Grid item>
            <Button
              disabled={
                !(
                  model.fileSource &&
                  (model.fileSource.blob || model.fileSource.url)
                )
              }
              variant="contained"
              color="primary"
              onClick={model.import}
            >
              Open
            </Button>
          </Grid>
        </Grid>
      </Container>
    )
  }
  ImportWizard.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }
  return observer(ImportWizard)
}
