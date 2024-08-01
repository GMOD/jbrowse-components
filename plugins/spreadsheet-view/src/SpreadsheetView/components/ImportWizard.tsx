import React, { useEffect, useState } from 'react'
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
import { AbstractRootModel, FileLocation, getSession } from '@jbrowse/core/util'
import {
  FileSelector,
  ErrorMessage,
  AssemblySelector,
  LoadingEllipses,
} from '@jbrowse/core/ui'

// locals
import { ImportWizardModel } from '../models/ImportWizard'
import { getFileType } from './util'

const useStyles = makeStyles()({
  container: {
    margin: '0 auto',
    maxWidth: '25em',
    padding: 20,
  },
})

function FormControl2({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <FormControl>{children}</FormControl>
    </div>
  )
}

const ImportWizard = observer(({ model }: { model: ImportWizardModel }) => {
  const session = getSession(model)
  const { classes } = useStyles()
  const { assemblyNames, assemblyManager } = session
  const { fileTypes, error, loading } = model
  const [selected, setSelected] = useState(assemblyNames[0])
  const err = assemblyManager.get(selected)?.error || error
  const rootModel = getRoot<AbstractRootModel>(model)
  const [tmp, setTmp] = useState<FileLocation>()
  const [fileType, setFileType] = useState(getFileType(tmp))
  useEffect(() => {
    setFileType(getFileType(tmp))
  }, [tmp])

  return (
    <div className={classes.container}>
      {err ? <ErrorMessage error={err} /> : null}
      {loading ? <LoadingEllipses /> : null}
      <FormControl2>
        <FormLabel>File</FormLabel>
        <FormGroup>
          <FileSelector
            location={tmp}
            setLocation={arg => setTmp(arg)}
            rootModel={rootModel}
          />
        </FormGroup>
      </FormControl2>
      <FormControl2>
        <FormLabel>File type</FormLabel>
        <RadioGroup row value={fileType}>
          {fileTypes.map(fileTypeName => (
            <FormControlLabel
              key={fileTypeName}
              checked={fileType === fileTypeName}
              value={fileTypeName}
              onClick={() => setFileType(fileTypeName)}
              control={<Radio />}
              label={fileTypeName}
            />
          ))}
        </RadioGroup>
      </FormControl2>
      <div>
        <AssemblySelector
          session={session}
          selected={selected}
          onChange={val => setSelected(val)}
        />
      </div>
      <Button
        variant="contained"
        data-testid="open_spreadsheet"
        color="primary"
        onClick={() => {
          model.setFileType(fileType)
          model.setSpreadsheetFilehandle(tmp)
        }}
      >
        Open
      </Button>
    </div>
  )
})

export default ImportWizard
