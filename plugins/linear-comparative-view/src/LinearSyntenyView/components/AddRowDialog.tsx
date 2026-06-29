import { useState } from 'react'

import { AssemblySelector, ErrorBanner, SubmitDialog } from '@jbrowse/core/ui'
import { getEnv, getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import {
  ImportSyntenyOpenCustomTrack,
  defaultSyntenyFileFormats,
} from '@jbrowse/synteny-core'
import {
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { toJS } from 'mobx'
import { observer } from 'mobx-react'

import { getAddRowOptions } from '../util/syntenyTracks.ts'

import type { LinearComparativeViewModel } from '../../LinearComparativeView/model.ts'
import type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

type UserOpened = Extract<ImportFormSyntenyTrack, { type: 'userOpened' }>

const AddRowDialog = observer(function AddRowDialog({
  model,
  handleClose,
}: {
  model: LinearComparativeViewModel
  handleClose: () => void
}) {
  const session = getSession(model)
  const { pluginManager } = getEnv(model)
  const { assemblyNames } = session
  const terminalAssembly =
    model.views[model.views.length - 1]?.assemblyNames[0] ?? ''
  const options = getAddRowOptions(session, terminalAssembly)

  // pre-configured datasets carry their own other-endpoint assembly; a custom
  // upload needs the user to name the assembly being added
  const [mode, setMode] = useState(options.length ? 'existing' : 'custom')
  const [trackId, setTrackId] = useState(options[0]?.trackId ?? '')
  const selected = options.find(o => o.trackId === trackId)
  const [newAssembly, setNewAssembly] = useState(
    assemblyNames.find(name => name !== terminalAssembly) ??
      assemblyNames[0] ??
      '',
  )
  const [customTrack, setCustomTrack] = useState<UserOpened['value']>()
  const [error, setError] = useState<unknown>()

  const canSubmit =
    mode === 'existing'
      ? Boolean(selected)
      : Boolean(customTrack) && Boolean(newAssembly)

  return (
    <SubmitDialog
      open
      title="Add assembly row"
      onCancel={handleClose}
      submitText="Add"
      submitDisabled={!canSubmit}
      onSubmit={() => {
        try {
          setError(undefined)
          if (mode === 'existing' && selected) {
            model.appendRow({
              assembly: selected.newAssembly,
              syntenyTrackId: selected.trackId,
            })
            handleClose()
          } else if (mode === 'custom' && customTrack && newAssembly) {
            if (isSessionWithAddTracks(session)) {
              session.addTrackConf(toJS(customTrack))
              model.appendRow({
                assembly: newAssembly,
                syntenyTrackId: customTrack.trackId,
              })
              handleClose()
            } else {
              setError(new Error("This session can't add tracks"))
            }
          }
        } catch (e) {
          console.error(e)
          setError(e)
        }
      }}
    >
      {error ? <ErrorBanner error={error} /> : null}
      <Typography gutterBottom>
        Add a new assembly row to the bottom of the view, connected to{' '}
        <b>{terminalAssembly}</b> by a synteny dataset (datasets pair two
        assemblies).
      </Typography>
      <RadioGroup
        row
        value={mode}
        onChange={event => {
          setMode(event.target.value)
        }}
      >
        <FormControlLabel
          value="existing"
          control={<Radio />}
          label="Existing dataset"
          disabled={!options.length}
        />
        <FormControlLabel
          value="custom"
          control={<Radio />}
          label="Open new track"
        />
      </RadioGroup>

      {mode === 'existing' ? (
        options.length ? (
          <TextField
            select
            fullWidth
            label="Synteny dataset"
            value={trackId}
            onChange={event => {
              setTrackId(event.target.value)
            }}
          >
            {options.map(o => (
              <MenuItem key={o.trackId} value={o.trackId}>
                {o.name} → {o.newAssembly}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <ErrorBanner
            error={`No synteny tracks found connecting to ${terminalAssembly}. Open a new track instead, or load a dataset that references this assembly.`}
          />
        )
      ) : (
        <>
          <Typography gutterBottom>Assembly to add as the new row:</Typography>
          <AssemblySelector
            helperText=""
            selected={newAssembly}
            onChange={newAsm => {
              setNewAssembly(newAsm)
              // the upload below is keyed to the pair, so changing the
              // assembly invalidates a previously chosen file
              setCustomTrack(undefined)
            }}
            session={session}
          />
          <ImportSyntenyOpenCustomTrack
            key={`${terminalAssembly}-${newAssembly}`}
            assembly1={terminalAssembly}
            assembly2={newAssembly}
            extensionPoint="LinearSyntenyView-SyntenyFileFormats"
            baseFormats={defaultSyntenyFileFormats}
            pluginManager={pluginManager}
            onSetTrack={val => {
              setCustomTrack(val.type === 'userOpened' ? val.value : undefined)
            }}
          />
        </>
      )}
    </SubmitDialog>
  )
})

export default AddRowDialog
