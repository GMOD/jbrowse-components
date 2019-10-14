export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer, PropTypes } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState } = React
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const TextField = jbrequire('@material-ui/core/TextField')
  const Button = jbrequire('@material-ui/core/Button')
  const Typography = jbrequire('@material-ui/core/Typography')
  const ToggleButton = jbrequire('@material-ui/lab/ToggleButton')
  const ToggleButtonGroup = jbrequire('@material-ui/lab/ToggleButtonGroup')
  const Grid = jbrequire('@material-ui/core/Grid')

  // const DropzoneArea = jbrequire(require('./Dropzone/DropzoneArea'))

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        marginBottom: theme.spacing(1),
        background: 'white',
      },
      urlChooser: {},
    }
  })

  function UrlChooser({ model }) {
    const classes = useStyles()
    const handleChange = evt => {
      model.setFileSource({ url: evt.target.value })
    }
    return (
      <TextField
        required
        className={classes.urlChooser}
        margin="dense"
        fullWidth
        defaultValue={model.fileSource && model.fileSource.url}
        onChange={handleChange}
      />
    )
  }
  UrlChooser.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  function LocalFileChooser({ model }) {
    const handleChange = ({ target }) => {
      if (target.files[0]) {
        model.setFileSource({
          blob: target.files[0],
        })
      }
    }

    const filename =
      model.fileSource && model.fileSource.blob && model.fileSource.blob.name

    return (
      <div style={{ position: 'relative' }}>
        <Button size="small" variant="contained" component="label">
          Choose File
          <input
            type="file"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              opacity: 0,
            }}
            onChange={handleChange}
          />
        </Button>
        <Typography
          style={{ marginLeft: '0.4rem' }}
          variant="body1"
          component="span"
        >
          {filename}
        </Typography>
      </div>
    )
  }
  LocalFileChooser.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  function FileSelector({ model }) {
    const classes = useStyles()

    const fileOrUrl = model.fileSource && model.fileSource.url ? 'url' : 'file'

    const handleFileOrUrlChange = (event, newValue) => {
      if (newValue === 'url' && !(model.fileSource && model.fileSource.url))
        model.setFileSource({ url: 'https://' })
      else model.setFileSource(undefined)
    }

    return (
      <Grid container spacing={1} direction="row" alignItems="center">
        <Grid item>
          <ToggleButtonGroup
            value={fileOrUrl}
            exclusive
            size="small"
            onChange={handleFileOrUrlChange}
            aria-label="file or url picker"
          >
            <ToggleButton value="file" aria-label="local file">
              File
            </ToggleButton>
            <ToggleButton value="url" aria-label="url">
              Url
            </ToggleButton>
          </ToggleButtonGroup>
        </Grid>
        <Grid item>
          {fileOrUrl === 'url' ? (
            <UrlChooser model={model} />
          ) : (
            <LocalFileChooser model={model} />
          )}
        </Grid>
      </Grid>
    )
  }
  FileSelector.propTypes = {
    model: PropTypes.objectOrObservableObject.isRequired,
  }

  return observer(FileSelector)
}
