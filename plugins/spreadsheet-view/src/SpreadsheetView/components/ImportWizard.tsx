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
  TextField,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import { AbstractRootModel, getSession } from '@jbrowse/core/util'
import { FileSelector, ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import { ImportWizardModel } from '../models/ImportWizard'

const useStyles = makeStyles()(theme => ({
  buttonContainer: { marginTop: theme.spacing(1) },
}))

const NumberEditor = observer(
  ({
    model,
    disabled,
    modelPropName,
    modelSetterName,
  }: {
    model: ImportWizardModel
    disabled: boolean
    modelPropName: string
    modelSetterName: string
  }) => {
    // @ts-ignore
    const [val, setVal] = useState(model[modelPropName])
    useEffect(() => {
      const num = parseInt(val, 10)
      if (!Number.isNaN(num)) {
        if (num > 0) {
          // @ts-ignore
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

const ImportWizard = observer(({ model }: { model: ImportWizardModel }) => {
  const session = getSession(model)
  const { classes } = useStyles()
  const { assemblyNames, assemblyManager } = session
  const {
    fileType,
    fileTypes,
    setFileType,
    hasColumnNameLine,
    toggleHasColumnNameLine,
    error,
  } = model
  const [selected, setSelected] = useState(assemblyNames[0])
  const err = assemblyManager.get(selected)?.error || error
  const showRowControls = model.fileType === 'CSV' || model.fileType === 'TSV'
  const rootModel = getRoot(model)

  return (
    <Container>
      {err ? <ErrorMessage error={err} /> : null}
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
                rootModel={rootModel as AbstractRootModel}
              />
            </FormGroup>
          </FormControl>
        </Grid>
        <Grid item>
          <FormControl component="fieldset">
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
            <FormControl component="fieldset">
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

export default ImportWizard
