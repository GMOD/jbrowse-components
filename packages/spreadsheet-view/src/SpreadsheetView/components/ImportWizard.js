export default pluginManager => {
  const { jbrequire } = pluginManager
  const { observer } = jbrequire('mobx-react')
  const React = jbrequire('react')
  const { useState, useEffect } = React
  const { makeStyles } = jbrequire('@material-ui/core/styles')
  const { Card, CardContent } = jbrequire('@material-ui/core')
  const FormControl = jbrequire('@material-ui/core/FormControl')
  const FormGroup = jbrequire('@material-ui/core/FormGroup')
  const FormLabel = jbrequire('@material-ui/core/FormLabel')
  const FormControlLabel = jbrequire('@material-ui/core/FormControlLabel')
  const Checkbox = jbrequire('@material-ui/core/Checkbox')
  const RadioGroup = jbrequire('@material-ui/core/RadioGroup')
  const Radio = jbrequire('@material-ui/core/Radio')
  const Container = jbrequire('@material-ui/core/Container')
  const Button = jbrequire('@material-ui/core/Button')
  const Grid = jbrequire('@material-ui/core/Grid')
  const Typography = jbrequire('@material-ui/core/Typography')
  const TextField = jbrequire('@material-ui/core/TextField')
  const { red } = jbrequire('@material-ui/core/colors')

  const FileSelector = jbrequire(require('./FileSelector'))

  const useStyles = makeStyles(theme => {
    return {
      root: {
        position: 'relative',
        padding: theme.spacing(1),
        background: 'white',
      },
      errorCard: {
        width: '50%',
        margin: [[theme.spacing(2), 'auto']],
        border: [['2px', 'solid', red[200]]],
      },
      errorMessage: {
        color: red[400],
      },
    }
  })

  const NumberEditor = observer(
    ({ model, disabled, modelPropName, modelSetterName }) => {
      const [val, setVal] = useState(model[modelPropName])
      useEffect(() => {
        const num = parseInt(val, 10)
        if (!Number.isNaN(num)) {
          if (num > 0) model[modelSetterName](num)
          else setVal(1)
        }
      }, [model, modelSetterName, val])
      return (
        <TextField
          value={val}
          disabled={disabled}
          type="number"
          onChange={evt => setVal(evt.target.value)}
          style={{ width: '2rem', verticalAlign: 'baseline' }}
        />
      )
    },
  )
  const ImportForm = observer(({ model }) => {
    const classes = useStyles()
    const showColumnNameRowControls =
      model.fileType === 'CSV' || model.fileType === 'TSV'

    return (
      <Container>
        <Grid
          style={{ width: '25rem', margin: '0 auto' }}
          container
          spacing={1}
          direction="column"
          alignItems="flex-start"
        >
          <Grid item>
            <FormControl component="fieldset">
              <FormLabel component="legend">Tabular file</FormLabel>
              <FormGroup>
                <FileSelector
                  fileRecord={model.fileSource}
                  onChange={model.setFileSource}
                />
              </FormGroup>
            </FormControl>
          </Grid>
          <Grid item>
            <FormControl component="fieldset" className={classes.formControl}>
              <FormLabel component="legend">File Type</FormLabel>
              <RadioGroup
                aria-label="file type"
                name="type"
                value={model.fileType}
              >
                <Grid container spacing={1} direction="row">
                  {model.fileTypes.map(fileTypeName => {
                    return (
                      <Grid item key={fileTypeName}>
                        <FormControlLabel
                          checked={model.fileType === fileTypeName}
                          value={fileTypeName}
                          onClick={() => model.setFileType(fileTypeName)}
                          control={<Radio />}
                          label={fileTypeName}
                        />
                      </Grid>
                    )
                  })}
                </Grid>
              </RadioGroup>
            </FormControl>
          </Grid>
          {showColumnNameRowControls ? (
            <Grid item>
              <FormControl component="fieldset" className={classes.formControl}>
                <FormLabel component="legend">Column Names</FormLabel>
                <div>
                  <FormControlLabel
                    disabled={!showColumnNameRowControls}
                    label="has column names on line"
                    labelPlacement="end"
                    control={
                      <Checkbox
                        checked={model.hasColumnNameLine}
                        onClick={model.toggleHasColumnNameLine}
                      />
                    }
                  />
                  <NumberEditor
                    model={model}
                    disabled={
                      !showColumnNameRowControls || !model.hasColumnNameLine
                    }
                    modelPropName="columnNameLineNumber"
                    modelSetterName="setColumnNameLineNumber"
                  />
                </div>
              </FormControl>
            </Grid>
          ) : null}
          <Grid item>
            {model.canCancel ? (
              <Button
                variant="contained"
                color="default"
                onClick={model.cancelButton}
                disabled={!model.canCancel}
              >
                Cancel
              </Button>
            ) : null}{' '}
            <Button
              disabled={!model.isReadyToOpen}
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
  })

  const ErrorDisplay = observer(({ errorMessage }) => {
    const classes = useStyles()
    return (
      <Card className={classes.errorCard}>
        <CardContent>
          <Typography variant="h6" className={classes.errorMessage}>
            {String(errorMessage)}
          </Typography>
        </CardContent>
      </Card>
    )
  })

  const ImportWizard = observer(({ model }) => {
    const classes = useStyles()
    return (
      <>
        {model.error ? (
          <Container className={classes.errorContainer}>
            <ErrorDisplay
              errorMessage={String(model.error.message)}
              stackTrace={model.error.stackTrace}
            />
          </Container>
        ) : null}
        <ImportForm model={model} />
      </>
    )
  })

  return ImportWizard
}
