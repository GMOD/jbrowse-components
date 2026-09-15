import { useEffect, useRef, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { AssemblySelector, ErrorBanner, SubmitDialog } from '@jbrowse/core/ui'
import {
  getEnv,
  getSession,
  isAbortException,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'
import {
  createStopToken,
  isStopped,
  stopStopToken,
} from '@jbrowse/core/util/stopToken'
import { isAlive } from '@jbrowse/mobx-state-tree'
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

import { matchingRowLoc, zoomedInWindow } from '../util/matchingRowLoc.ts'
import { getAddRowOptions } from '../util/syntenyTracks.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { ImportFormSyntenyTrack } from '@jbrowse/synteny-core'

type UserOpened = Extract<ImportFormSyntenyTrack, { type: 'userOpened' }>

// A row names its assembly through its displayedRegions, so a row still loading
// names none — including the one this dialog just added, if it is reopened
// straight away. The pending launch carries the name until then, and without it
// the dialog anchors to '', which reaches no dataset and can add a track config
// naming an empty assembly.
function rowAssembly(
  row:
    | { assemblyNames: string[]; pendingLaunch?: { assembly: string } }
    | undefined,
) {
  return row?.assemblyNames[0] ?? row?.pendingLaunch?.assembly ?? ''
}

// Exactly what this dialog reads off the band above the bottom row: two fields
// of a level, named so the copy below is checked against something smaller than
// the whole level model.
interface LevelTracks {
  tracks: { configuration: AnyConfigurationModel }[]
}

const AddRowDialog = observer(function AddRowDialog({
  model,
  handleClose,
}: {
  model: LinearSyntenyViewModel
  handleClose: () => void
}) {
  const session = getSession(model)
  const { pluginManager } = getEnv(model)
  const { assemblyNames } = session
  const { views } = model
  const rowAssemblies = views.map(view => rowAssembly(view))
  const terminalAssembly = rowAssemblies.at(-1) ?? ''
  const bandAbove: LevelTracks | undefined = model.levels.at(-1)
  const { options, alreadyDrawn } = getAddRowOptions({
    session,
    terminalAssembly,
    levelAbove: bandAbove && {
      assembly: rowAssemblies.at(-2) ?? '',
      trackIds: bandAbove.tracks.map(
        t => readConfObject(t.configuration, 'trackId') as string,
      ),
    },
  })

  // pre-configured datasets carry their own other-endpoint assembly; a custom
  // upload needs the user to name the assembly being added
  const [mode, setMode] = useState<'existing' | 'custom'>(
    options.length ? 'existing' : 'custom',
  )
  // resolved every render rather than snapshotted: options can grow after mount
  // (a connection finishing its load), and a preference that isn't in the list
  // would leave the Select blank with Add disabled
  const [preferredOptionId, setOptionId] = useState('')
  const selected = options.find(o => o.id === preferredOptionId) ?? options[0]
  // an assembly the stack doesn't already hold, since a new row is normally a
  // new genome; the first assembly otherwise, which the Select can change
  const [newAssembly, setNewAssembly] = useState(
    assemblyNames.find(name => !rowAssemblies.includes(name)) ??
      assemblyNames[0] ??
      '',
  )
  const [customTrack, setCustomTrack] = useState<UserOpened['value']>()
  const [error, setError] = useState<unknown>()
  const [isLocating, setLocating] = useState(false)
  const locating = useRef<StopToken>(undefined)
  useEffect(
    () => () => {
      stopStopToken(locating.current)
    },
    [],
  )

  const canSubmit =
    Boolean(terminalAssembly) &&
    !isLocating &&
    (mode === 'existing'
      ? Boolean(selected)
      : Boolean(customTrack) && Boolean(newAssembly))

  // The region lookup outlives a Cancel, so the answer has to check that the
  // dialog is still the one asking: a row appended after Cancel is a row the
  // reader refused, and appending onto a closed view throws. A lookup that
  // fails still adds the row, on its whole genome — the alignment is a
  // convenience, and a broken track reports itself on the band.
  async function add(assembly: string, syntenyTrackId: string) {
    const row = views.at(-1)!
    const region = zoomedInWindow(row)
    const stopToken = createStopToken()
    locating.current = stopToken
    setLocating(true)
    try {
      const loc = region
        ? await matchingRowLoc({
            session,
            trackId: syntenyTrackId,
            region,
            assembly,
            widthPx: row.width,
            stopToken,
          }).catch((e: unknown) => {
            if (isAbortException(e)) {
              throw e
            }
            console.warn(e)
            return undefined
          })
        : undefined
      if (isStopped(stopToken) || !isAlive(model)) {
        return
      }
      void model.appendRow({ assembly, loc, syntenyTrackId })
      handleClose()
    } catch (e) {
      if (!isAbortException(e)) {
        throw e
      }
    } finally {
      if (locating.current === stopToken) {
        locating.current = undefined
        setLocating(false)
      }
    }
  }

  function cancel() {
    stopStopToken(locating.current)
    handleClose()
  }

  async function submit() {
    if (mode === 'existing' && selected) {
      await add(selected.newAssembly, selected.trackId)
    } else if (mode === 'custom' && customTrack && newAssembly) {
      if (!isSessionWithAddSessionTrack(session)) {
        throw new Error("This session can't add tracks")
      }
      session.addSessionTrackConf(toJS(customTrack))
      await add(newAssembly, customTrack.trackId)
    }
  }

  return (
    <SubmitDialog
      open
      title="Add assembly row"
      onCancel={cancel}
      submitText="Add"
      submitDisabled={!canSubmit}
      onSubmit={() => {
        setError(undefined)
        submit().catch((e: unknown) => {
          console.error(e)
          setError(e)
        })
      }}
    >
      {error ? <ErrorBanner error={error} /> : null}
      {isLocating ? (
        <Typography gutterBottom>
          Finding the region that aligns to the {terminalAssembly} window...
        </Typography>
      ) : null}
      {terminalAssembly ? (
        <Typography gutterBottom>
          Add a new assembly row to the bottom of the view, connected to{' '}
          <b>{terminalAssembly}</b> by a synteny dataset.
        </Typography>
      ) : (
        /* Nothing to append to: the bottom row has not resolved an assembly, so
        there is no pair for a dataset to span. The header menu hides this
        dialog while the view has no rows at all; this covers the rest — a row
        whose assembly failed to load. */
        <Typography gutterBottom>
          The bottom row of this view has no assembly yet, so there is nothing
          for a new row to connect to.
        </Typography>
      )}
      <RadioGroup
        row
        value={mode}
        onChange={event => {
          setMode(event.target.value === 'custom' ? 'custom' : 'existing')
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

      {/* Says why "Existing dataset" is greyed out, and sits outside the mode
      branch below rather than in it: the mode that branch would have shown it
      in is precisely the one a dataset-less session can never be in, since
      `mode` starts on 'custom' when there is nothing to pick and the radio back
      to 'existing' is disabled. A note rather than an ErrorBanner — the upload
      form under it is a working way to add the row, so nothing has failed. */}
      {options.length === 0 && terminalAssembly ? (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {alreadyDrawn.length ? (
            // where a two-row view opened on its one synteny track lands: the
            // only dataset that connects is the one already drawn above
            <>
              {alreadyDrawn.map(o => o.name).join(', ')} already draws the band
              above {terminalAssembly}, and a second copy below it would only
              mirror that band. Open a new track to extend the stack with
              another assembly.
            </>
          ) : (
            <>
              No synteny dataset in this session connects to {terminalAssembly}{' '}
              — open a new track instead, or load a dataset that references this
              assembly.
            </>
          )}
        </Typography>
      ) : null}

      {mode === 'existing' ? (
        options.length ? (
          <TextField
            select
            variant="outlined"
            fullWidth
            label="Assembly to add"
            value={selected?.id ?? ''}
            onChange={event => {
              setOptionId(event.target.value)
            }}
          >
            {options.map(o => {
              // an assembly can legitimately appear twice in a stack (two
              // aligners' takes on the same pair, one band each), so this is a
              // note on the option rather than a reason to drop it
              const existingRow = rowAssemblies.indexOf(o.newAssembly)
              return (
                <MenuItem key={o.id} value={o.id}>
                  {o.newAssembly} — via {o.name}
                  {existingRow === -1
                    ? ''
                    : ` (already row ${existingRow + 1})`}
                </MenuItem>
              )
            })}
          </TextField>
        ) : null
      ) : (
        <>
          <AssemblySelector
            label="Assembly to add"
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
