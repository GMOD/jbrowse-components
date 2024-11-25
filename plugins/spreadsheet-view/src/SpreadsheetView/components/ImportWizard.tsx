import React, { useState } from 'react'
import { FileSelector, ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  Checkbox,
  FormControl,
  FormGroup,
  FormLabel,
  FormControlLabel,
  RadioGroup,
  Radio,
} from '@mui/material'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'

// locals
import { makeStyles } from 'tss-react/mui'
import NumberEditor from './NumberEditor'
import type { ImportWizardModel } from '../models/ImportWizard'
import type { AbstractRootModel } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  container: {
    margin: '0 auto',
    maxWidth: '25em',
    padding: 20,
  },
})

const ImportWizard = observer(({ model }: { model: ImportWizardModel }) => {
  const session = getSession(model)
  const { classes } = useStyles()
  const { assemblyNames, assemblyManager } = session
  const {
    fileType,
    canCancel,
    fileSource,
    isReadyToOpen,
    fileTypes,
    hasColumnNameLine,
    error,
  } = model
  const [selected, setSelected] = useState(assemblyNames[0])
  const err = assemblyManager.get(selected!)?.error || error
  const showRowControls = fileType === 'CSV' || fileType === 'TSV'
  const rootModel = getRoot(model)

  return (
    <div className={classes.container}>
      {err ? <ErrorMessage error={err} /> : null}
      <div>
        <FormControl component="fieldset">
          <FormLabel component="legend">Tabular file</FormLabel>
          <FormGroup>
            <FileSelector
              location={fileSource}
              setLocation={arg => {
                model.setFileSource(arg)
              }}
              rootModel={rootModel as AbstractRootModel}
            />
          </FormGroup>
        </FormControl>
      </div>
      <div>
        <FormControl component="fieldset">
          <FormLabel component="legend">File Type</FormLabel>
          <RadioGroup row aria-label="file type" name="type" value={fileType}>
            {fileTypes.map(fileTypeName => (
              <FormControlLabel
                key={fileTypeName}
                checked={fileType === fileTypeName}
                value={fileTypeName}
                onClick={() => {
                  model.setFileType(fileTypeName)
                }}
                control={<Radio />}
                label={fileTypeName}
              />
            ))}
          </RadioGroup>
        </FormControl>
      </div>
      {showRowControls ? (
        <div>
          <FormControl component="fieldset">
            <FormLabel component="legend">Column Names</FormLabel>
            <FormControlLabel
              disabled={!showRowControls}
              label="has column names on line"
              labelPlacement="end"
              control={
                <Checkbox
                  checked={hasColumnNameLine}
                  onClick={() => {
                    model.toggleHasColumnNameLine()
                  }}
                />
              }
            />
            <NumberEditor
              model={model}
              disabled={!hasColumnNameLine}
              modelPropName="columnNameLineNumber"
              modelSetterName="setColumnNameLineNumber"
            />
          </FormControl>
        </div>
      ) : null}
      <div>
        <AssemblySelector
          session={session}
          selected={selected}
          onChange={val => {
            setSelected(val)
          }}
        />
      </div>
      <div>
        {canCancel ? (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              model.cancelButton()
            }}
            disabled={!canCancel}
          >
            Cancel
          </Button>
        ) : null}{' '}
        <Button
          disabled={!isReadyToOpen || !!err}
          variant="contained"
          data-testid="open_spreadsheet"
          color="primary"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            model.import(selected!)
          }}
        >
          Open
        </Button>
      </div>
    </div>
  )
})

export default ImportWizard
