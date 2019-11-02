export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const ReactPropTypes = jbrequire('prop-types')
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
    }
  })

  function UrlChooser({ fileRecord, onChange }) {
    const classes = useStyles()
    const handleChange = evt => {
      onChange({ url: evt.target.value })
    }
    return (
      <TextField
        required
        className={classes.urlChooser}
        margin="dense"
        fullWidth
        defaultValue={fileRecord && fileRecord.url}
        onChange={handleChange}
      />
    )
  }
  UrlChooser.propTypes = {
    fileRecord: ReactPropTypes.shape(),
    onChange: ReactPropTypes.func,
  }
  UrlChooser.defaultProps = {
    fileRecord: undefined,
    onChange: () => {},
  }

  function LocalFileChooser({ fileRecord, onChange }) {
    const handleChange = ({ target }) => {
      if (target.files[0]) {
        onChange({
          blob: target.files[0],
        })
      }
    }

    const filename = fileRecord && fileRecord.blob && fileRecord.blob.name

    return (
      <div style={{ position: 'relative' }}>
        <Button size="small" variant="outlined" component="label">
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
    fileRecord: ReactPropTypes.shape(),
    onChange: ReactPropTypes.func,
  }
  LocalFileChooser.defaultProps = {
    fileRecord: undefined,
    onChange: () => {},
  }

  function FileSelector(props) {
    const { fileRecord, onChange } = props
    // const classes = useStyles()

    const fileOrUrl = fileRecord && fileRecord.url ? 'url' : 'file'

    const handleFileOrUrlChange = (event, newValue) => {
      if (newValue === 'url' && !(fileRecord && fileRecord.url))
        onChange({ url: 'https://' })
      else onChange(undefined)
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
            <UrlChooser {...props} />
          ) : (
            <LocalFileChooser {...props} />
          )}
        </Grid>
      </Grid>
    )
  }
  FileSelector.propTypes = {
    fileRecord: ReactPropTypes.shape(),
    onChange: ReactPropTypes.func,
  }
  FileSelector.defaultProps = {
    fileRecord: undefined,
    onChange: () => {},
  }

  return observer(FileSelector)
}
