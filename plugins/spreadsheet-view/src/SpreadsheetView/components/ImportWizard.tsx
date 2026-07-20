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

import { fileTypes } from '../ImportWizard.ts'
import TrackSelector from './TrackSelector.tsx'

import type { SpreadsheetViewModel } from '../SpreadsheetViewModel.ts'
import type { AbstractRootModel } from '@jbrowse/core/util'

type SelectorType = 'custom' | 'existing'

const selectorTypes: { value: SelectorType; label: string }[] = [
  { value: 'custom', label: 'Open file from URL or local computer' },
  { value: 'existing', label: 'Open from track' },
]

const useStyles = makeStyles()({
  container: {
    margin: '0 auto',
    maxWidth: '40em',
    padding: 20,
  },
})

function RadioSelector<T extends string>({
  legend,
  ariaLabel,
  name,
  value,
  options,
  onChange,
}: {
  legend?: string
  ariaLabel: string
  name: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <FormControl component="fieldset">
      {legend ? <FormLabel component="legend">{legend}</FormLabel> : null}
      <RadioGroup
        row
        aria-label={ariaLabel}
        name={name}
        value={value}
        onChange={event => {
          onChange(event.target.value as T)
        }}
      >
        {options.map(({ value, label }) => (
          <FormControlLabel
            key={value}
            value={value}
            control={<Radio />}
            label={label}
          />
        ))}
      </RadioGroup>
    </FormControl>
  )
}

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
  const selectedAssembly = importWizard.selectedAssemblyName ?? assemblyNames[0]
  const [selectorType, setSelectorType] = useState<SelectorType>('custom')
  const assemblyError = selectedAssembly
    ? assemblyManager.get(selectedAssembly)?.error
    : undefined
  const err = assemblyError ?? error
  const rootModel = getRoot<AbstractRootModel>(model)

  return (
    <div>
      {err ? <ErrorBanner error={err} /> : null}
      <Paper className={classes.container}>
        {loading ? <LoadingEllipses variant="h6" /> : null}
        <div>
          <RadioSelector
            ariaLabel="import source"
            name="source"
            value={selectorType}
            options={selectorTypes}
            onChange={next => {
              setSelectorType(next)
              if (next === 'existing' && selectedAssembly) {
                importWizard.selectDefaultTrack(selectedAssembly)
              }
            }}
          />
        </div>
        {selectorType === 'custom' ? (
          <div>
            <FileSelector
              inline
              location={fileSource}
              rootModel={rootModel}
              setLocation={arg => {
                importWizard.setFileSource(arg)
              }}
            />
          </div>
        ) : selectedAssembly ? (
          <TrackSelector
            key={selectedAssembly}
            model={importWizard}
            selectedAssembly={selectedAssembly}
          />
        ) : (
          <div>Select assembly</div>
        )}
        <div>
          <RadioSelector
            legend="File Type"
            ariaLabel="file type"
            name="type"
            value={fileType}
            options={fileTypes.map(f => ({ value: f, label: f }))}
            onChange={val => {
              importWizard.setFileType(val)
            }}
          />
        </div>

        <div>
          <AssemblySelector
            session={session}
            selected={selectedAssembly}
            onChange={val => {
              importWizard.setSelectedAssemblyName(val)
              if (selectorType === 'existing') {
                importWizard.selectDefaultTrack(val)
              }
            }}
          />
        </div>
        <div>
          <Button
            disabled={
              !selectedAssembly || !isReadyToOpen || Boolean(err) || loading
            }
            variant="contained"
            data-testid="open_spreadsheet"
            color="primary"
            onClick={() => {
              if (selectedAssembly) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                model.loadSpreadsheet(selectedAssembly)
              }
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
