import { useState } from 'react'

import {
  AssemblySelector,
  ErrorMessage,
  FileSelector,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getRoot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
} from '@mui/material'
import { observer } from 'mobx-react'

import TrackSelector from './TrackSelector'

import type { ImportWizardModel } from '../ImportWizard'
import type { AbstractRootModel } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  container: {
    margin: '0 auto',
    maxWidth: '40em',
    padding: 20,
  },
})

const ImportWizard = observer(function ({
  model,
}: {
  model: ImportWizardModel
}) {
  const session = getSession(model)
  const { classes } = useStyles()
  const { assemblyNames, assemblyManager } = session
  const { loading, fileType, fileSource, isReadyToOpen, fileTypes, error } =
    model
  const [selectedAssembly, setSelectedAssembly] = useState(assemblyNames[0])
  const [selectorType, setSelectorType] = useState('custom')
  const err = assemblyManager.get(selectedAssembly!)?.error || error
  const rootModel = getRoot(model)

  return (
    <div>
      {err ? <ErrorMessage error={err} /> : null}
      <Paper className={classes.container}>
        {loading ? <LoadingEllipses variant="h6" /> : null}
        <div>
          <FormControl component="fieldset">
            <RadioGroup
              row
              aria-label="file type"
              name="type"
              value={fileType}
              onChange={event => {
                setSelectorType(event.target.value)
              }}
            >
              {Object.entries({
                custom: 'Open file from URL or local computer',
                existing: 'Open from track',
              }).map(([key, val]) => (
                <FormControlLabel
                  key={key}
                  checked={selectorType === key}
                  value={key}
                  control={<Radio />}
                  label={val}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </div>
        {selectorType === 'custom' ? (
          <div>
            <FormControl component="fieldset">
              <FormGroup>
                <FileSelector
                  inline
                  location={fileSource}
                  rootModel={rootModel as AbstractRootModel}
                  setLocation={arg => {
                    model.setFileSource(arg)
                  }}
                />
              </FormGroup>
            </FormControl>
          </div>
        ) : selectedAssembly ? (
          <TrackSelector model={model} selectedAssembly={selectedAssembly} />
        ) : (
          <div>Select assembly</div>
        )}
        <div>
          <FormControl component="fieldset">
            <FormLabel component="legend">File Type</FormLabel>
            <RadioGroup
              row
              aria-label="file type"
              name="type"
              value={fileType}
              onChange={event => {
                model.setFileType(event.target.value)
              }}
            >
              {fileTypes.map(fileTypeName => (
                <FormControlLabel
                  key={fileTypeName}
                  checked={fileType === fileTypeName}
                  value={fileTypeName}
                  control={<Radio />}
                  label={fileTypeName}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </div>

        <div>
          <AssemblySelector
            session={session}
            selected={selectedAssembly}
            onChange={val => {
              setSelectedAssembly(val)
            }}
          />
        </div>
        <div>
          <Button
            disabled={!isReadyToOpen || !!err}
            variant="contained"
            data-testid="open_spreadsheet"
            color="primary"
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              model.import(selectedAssembly!)
            }}
          >
            Open
          </Button>
        </div>
      </Paper>
    </div>
  )
})

export default ImportWizard
