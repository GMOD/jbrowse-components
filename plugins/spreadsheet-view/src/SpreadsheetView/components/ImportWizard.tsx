import { useState } from 'react'

import {
  AssemblySelector,
  ErrorBanner,
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
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
} from '@mui/material'
import { observer } from 'mobx-react'

import TrackSelector from './TrackSelector.tsx'
import { fileTypes } from '../ImportWizard.ts'

import type { SpreadsheetViewModel } from '../SpreadsheetViewModel.ts'
import type { AbstractRootModel } from '@jbrowse/core/util'

type SelectorType = 'custom' | 'existing'

const selectorTypes: { key: SelectorType; label: string }[] = [
  { key: 'custom', label: 'Open file from URL or local computer' },
  { key: 'existing', label: 'Open from track' },
]

const useStyles = makeStyles()({
  container: {
    margin: '0 auto',
    maxWidth: '40em',
    padding: 20,
  },
})

const ImportWizard = observer(function ImportWizard({
  model,
}: {
  model: SpreadsheetViewModel
}) {
  const session = getSession(model)
  const { classes } = useStyles()
  const { assemblyNames, assemblyManager } = session
  const { importWizard } = model
  const { loading, fileType, fileSource, isReadyToOpen, error } = importWizard
  const [selectedAssembly, setSelectedAssembly] = useState(
    importWizard.selectedAssemblyName ?? assemblyNames[0],
  )
  const [selectorType, setSelectorType] = useState<SelectorType>('custom')
  const err = assemblyManager.get(selectedAssembly!)?.error ?? error
  const rootModel = getRoot(model)

  return (
    <div>
      {err ? <ErrorBanner error={err} /> : null}
      <Paper className={classes.container}>
        {loading ? <LoadingEllipses variant="h6" /> : null}
        <div>
          <FormControl component="fieldset">
            <RadioGroup
              row
              aria-label="file type"
              name="type"
              value={selectorType}
              onChange={event => {
                setSelectorType(event.target.value as SelectorType)
              }}
            >
              {selectorTypes.map(({ key, label }) => (
                <FormControlLabel
                  key={key}
                  checked={selectorType === key}
                  value={key}
                  control={<Radio />}
                  label={label}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </div>
        {selectorType === 'custom' ? (
          <div>
            <FileSelector
              inline
              location={fileSource}
              rootModel={rootModel as AbstractRootModel}
              setLocation={arg => {
                importWizard.setFileSource(arg)
              }}
            />
          </div>
        ) : selectedAssembly ? (
          <TrackSelector
            model={importWizard}
            selectedAssembly={selectedAssembly}
          />
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
                importWizard.setFileType(event.target.value)
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
            disabled={!isReadyToOpen || Boolean(err) || loading}
            variant="contained"
            data-testid="open_spreadsheet"
            color="primary"
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              model.loadSpreadsheet(selectedAssembly!)
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
