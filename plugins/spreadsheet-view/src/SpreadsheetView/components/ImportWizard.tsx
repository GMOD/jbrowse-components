import React, { useState } from 'react'
import {
  Button,
  FormControl,
  FormGroup,
  FormLabel,
  FormControlLabel,
  RadioGroup,
  Radio,
} from '@mui/material'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'
import { AbstractRootModel, getSession } from '@jbrowse/core/util'
import {
  FileSelector,
  ErrorMessage,
  AssemblySelector,
  LoadingEllipses,
} from '@jbrowse/core/ui'

// locals
import { ImportWizardModel } from '../models/ImportWizard'

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
  const { fileType, fileSource, fileTypes, error, loading } = model
  const [selected, setSelected] = useState(assemblyNames[0])
  const err = assemblyManager.get(selected)?.error || error
  const showRowControls = fileType === 'CSV' || fileType === 'TSV'
  const rootModel = getRoot<AbstractRootModel>(model)

  return (
    <div className={classes.container}>
      {err ? <ErrorMessage error={err} /> : null}
      {loading ? <LoadingEllipses /> : null}
      <div>
        <FormControl component="fieldset">
          <FormLabel component="legend">Tabular file</FormLabel>
          <FormGroup>
            <FileSelector
              location={fileSource}
              setLocation={arg => model.setFileSource(arg)}
              rootModel={rootModel}
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
                onClick={() => model.setFileType(fileTypeName)}
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
          </FormControl>
        </div>
      ) : null}
      <div>
        <AssemblySelector
          session={session}
          selected={selected}
          onChange={val => setSelected(val)}
        />
      </div>
      <Button
        disabled={!!err}
        variant="contained"
        data-testid="open_spreadsheet"
        color="primary"
        onClick={() => {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          model.import(selected)
        }}
      >
        Open
      </Button>
    </div>
  )
})

export default ImportWizard
