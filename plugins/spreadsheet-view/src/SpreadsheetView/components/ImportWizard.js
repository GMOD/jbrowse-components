import React, { useState, useEffect } from 'react'

import {
  Card,
  CardContent,
  FormControl,
  FormGroup,
  FormLabel,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Container,
  Button,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Select,
  makeStyles,
} from '@material-ui/core'

import { observer } from 'mobx-react'
import { FileSelector } from '@jbrowse/core/ui'
import { readConfObject } from '@jbrowse/core/configuration'

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
      border: [['2px', 'solid', theme.palette.error.main]],
    },
    buttonContainer: { marginTop: theme.spacing(1) },
  }
})

const NumberEditor = observer(
  ({ model, disabled, modelPropName, modelSetterName }) => {
    const [val, setVal] = useState(model[modelPropName])
    useEffect(() => {
      const num = parseInt(val, 10)
      if (!Number.isNaN(num)) {
        if (num > 0) {
          model[modelSetterName](num)
        } else {
          setVal(1)
        }
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

  const {
    selectedAssemblyIdx,
    setSelectedAssemblyIdx,
    fileType,
    fileTypes,
    setFileType,
    hasColumnNameLine,
    toggleHasColumnNameLine,
    assemblyChoices,
  } = model

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
                location={model.fileSource}
                setLocation={model.setFileSource}
                localFileAllowed
              />
            </FormGroup>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl component="fieldset" className={classes.formControl}>
            <FormLabel component="legend">File Type</FormLabel>
            <RadioGroup aria-label="file type" name="type" value={fileType}>
              <Grid container spacing={1} direction="row">
                {fileTypes.map(fileTypeName => {
                  return (
                    <Grid item key={fileTypeName}>
                      <FormControlLabel
                        checked={fileType === fileTypeName}
                        value={fileTypeName}
                        onClick={() => setFileType(fileTypeName)}
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
                      checked={hasColumnNameLine}
                      onClick={toggleHasColumnNameLine}
                    />
                  }
                />
                <NumberEditor
                  model={model}
                  disabled={!showColumnNameRowControls || !hasColumnNameLine}
                  modelPropName="columnNameLineNumber"
                  modelSetterName="setColumnNameLineNumber"
                />
              </div>
            </FormControl>
          </Grid>
        ) : null}
        <Grid item>
          <FormControl fullWidth>
            <FormLabel component="legend">Associated with assembly</FormLabel>
            <Select
              value={selectedAssemblyIdx}
              onChange={evt => setSelectedAssemblyIdx(evt.target.value)}
            >
              {assemblyChoices.map((assembly, idx) => {
                const name = readConfObject(assembly, 'name')
                return (
                  <MenuItem key={name} value={idx}>
                    {name}
                  </MenuItem>
                )
              })}
            </Select>
          </FormControl>
        </Grid>
        <Grid item className={classes.buttonContainer}>
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
            data-testid="open_spreadsheet"
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
        <Typography variant="h6" color="error">
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
          <ErrorDisplay errorMessage={`${model.error}`} />
        </Container>
      ) : null}
      <ImportForm model={model} />
    </>
  )
})

export default ImportWizard
