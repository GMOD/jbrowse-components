import React, { useState, useEffect } from 'react'

import {
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
  makeStyles,
} from '@mui/material'

import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import { FileSelector } from '@jbrowse/core/ui'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'

const useStyles = makeStyles(theme => ({
  buttonContainer: { marginTop: theme.spacing(1) },
}))

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

const ErrorDisplay = observer(({ error }) => {
  return (
    <Typography variant="h6" color="error">
      {`${error}`}
    </Typography>
  )
})

const ImportForm = observer(({ model }) => {
  const session = getSession(model)
  const classes = useStyles()
  const { assemblyNames, assemblyManager } = session
  const {
    fileType,
    fileTypes,
    setFileType,
    hasColumnNameLine,
    toggleHasColumnNameLine,
  } = model
  const [selected, setSelected] = useState(assemblyNames[0])
  const err = assemblyManager.get(selected)?.error
  const showRowControls = model.fileType === 'CSV' || model.fileType === 'TSV'
  const rootModel = getRoot(model)

  return (
    <Container>
      {err ? <ErrorDisplay error={err} /> : null}
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
                rootModel={rootModel}
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
        {showRowControls ? (
          <Grid item>
            <FormControl component="fieldset" className={classes.formControl}>
              <FormLabel component="legend">Column Names</FormLabel>
              <div>
                <FormControlLabel
                  disabled={!showRowControls}
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
                  disabled={!showRowControls || !hasColumnNameLine}
                  modelPropName="columnNameLineNumber"
                  modelSetterName="setColumnNameLineNumber"
                />
              </div>
            </FormControl>
          </Grid>
        ) : null}
        <Grid item>
          <AssemblySelector
            session={session}
            selected={selected}
            onChange={val => setSelected(val)}
          />
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
            disabled={!model.isReadyToOpen || !!err}
            variant="contained"
            data-testid="open_spreadsheet"
            color="primary"
            onClick={() => model.import(selected)}
          >
            Open
          </Button>
        </Grid>
      </Grid>
    </Container>
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
