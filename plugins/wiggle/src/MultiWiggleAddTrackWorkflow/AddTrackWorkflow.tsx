import { useState } from 'react'

import { AssemblySelector, FileDropZone, SanitizedHTML } from '@jbrowse/core/ui'
import VirtualTable, {
  EditableTextCell,
  checkboxLeading,
  useTableSort,
} from '@jbrowse/core/ui/VirtualTable'
import {
  addTrackFromWidget,
  coarseStripHTML,
  getNotificationSink,
  getSession,
  workflowForm,
} from '@jbrowse/core/util'
import { nanoid } from '@jbrowse/core/util/nanoid'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import DeleteIcon from '@mui/icons-material/Delete'
import {
  Alert,
  Button,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  MIXED_MESSAGE,
  applyName,
  buildAdapterPayload,
  buildMultiRowTrackConf,
  canSubmit,
  classifyFile,
  classifyItem,
  parseItems,
  partition,
  sessionGuessers,
  stackKind,
} from './util.ts'
import { MULTI_ROW_WORKFLOW } from './workflowName.ts'

import type { Member, Refusal, StackKind } from './util.ts'
import type { VirtualTableColumn } from '@jbrowse/core/ui/VirtualTable'
import type { AddTrackWorkflowModel } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(),
    padding: theme.spacing(),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  },
  tableBox: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 300,
    marginTop: 4,
  },
}))

const KIND_WIDTH = 110

interface TrackRow {
  id: string
  name: string
  member: Member
}

function memberToRow(member: Member): TrackRow {
  return { id: nanoid(), name: member.name, member }
}

interface MultiRowForm {
  inputMode: 'paste' | 'upload'
  inputVal: string
  tracks: TrackRow[]
  refusals: Refusal[]
  trackName: string
}

const initialForm: MultiRowForm = {
  inputMode: 'paste',
  inputVal: '',
  tracks: [],
  refusals: [],
  trackName: 'Multi-row track',
}

const KIND_LABEL: Record<StackKind, string> = {
  quantitative: 'quantitative',
  feature: 'features',
}

const PASTE_HELP =
  "One URL per line: BigWig or bedGraph for quantitative rows, BED or BigBed for feature rows. Or a JSON array of subadapter configs, to set each row's color and name."

function doSubmit({
  trackName,
  tracks,
  kind,
  model,
}: {
  tracks: TrackRow[]
  trackName: string
  kind: StackKind
  model: AddTrackWorkflowModel
}) {
  const { assembly } = model
  if (!assembly) {
    throw new Error('Please choose an assembly')
  }
  // addTrackFromWidget tears the form down only once the track actually landed,
  // so a failure leaves the user's input intact to retry
  addTrackFromWidget({
    model,
    session: getSession(model),
    conf: buildMultiRowTrackConf({
      name: trackName.trim(),
      assemblyNames: [assembly],
      adapter: buildAdapterPayload(
        tracks.map(t => applyName(t.member, t.name)),
      ),
      kind,
    }),
  })
}

const MultiRowAddTrackWorkflow = observer(function MultiRowAddTrackWorkflow({
  model,
}: {
  model: AddTrackWorkflowModel
}) {
  const { classes } = useStyles()
  const { form, update } = workflowForm(model, MULTI_ROW_WORKFLOW, initialForm)
  const { inputMode, inputVal, tracks, refusals, trackName } = form
  const currentForm = () =>
    workflowForm(model, MULTI_ROW_WORKFLOW, initialForm).form
  const currentTracks = () => currentForm().tracks
  const guessers = sessionGuessers(model)
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set())

  function addClassified(classified: (Member | Refusal)[]) {
    const added = partition(classified)
    update({
      tracks: [...currentTracks(), ...added.members.map(memberToRow)],
      refusals: added.refusals,
    })
  }

  function addPasted() {
    const pasted = currentForm().inputVal
    if (pasted.trim()) {
      addClassified(
        parseItems(pasted).map(item => classifyItem(item, guessers)),
      )
      update({ inputVal: '' })
    }
  }

  // The paste box is hidden behind the drop zone, so what it holds joins the
  // grid first: Submit stacks only rows the form shows.
  function showInputMode(mode: MultiRowForm['inputMode']) {
    if (mode === 'upload') {
      addPasted()
    }
    update({ inputMode: mode })
  }

  const selectedIds = new Set(
    tracks.filter(t => ticked.has(t.id)).map(t => t.id),
  )
  const columns: VirtualTableColumn<TrackRow>[] = [
    {
      id: 'name',
      header: 'Name',
      fill: true,
      sortValue: row => coarseStripHTML(row.name),
      title: row => coarseStripHTML(row.name),
      cell: row => (
        <EditableTextCell
          value={row.name}
          label={`Rename ${coarseStripHTML(row.name)}`}
          allowBlank
          onCommit={name => {
            update({
              tracks: currentTracks().map(t =>
                t.id === row.id ? { ...t, name } : t,
              ),
            })
          }}
        >
          <SanitizedHTML html={row.name} />
        </EditableTextCell>
      ),
    },
    {
      id: 'kind',
      header: 'Data',
      sortValue: row => KIND_LABEL[row.member.kind],
      cell: row => KIND_LABEL[row.member.kind],
    },
  ]
  const { sortedRows: sortedTracks, sortProps } = useTableSort(tracks, columns)
  const pending = partition(
    inputVal.trim()
      ? parseItems(inputVal).map(item => classifyItem(item, guessers))
      : [],
  )
  const allTracks = [...tracks, ...pending.members.map(memberToRow)]
  const kind = stackKind(allTracks.map(t => t.member.kind))
  const refusalLines = [
    ...new Set(
      [...refusals, ...pending.refusals].map(r => `${r.name}: ${r.reason}`),
    ),
  ]

  return (
    <Paper
      className={classes.paper}
      onDragEnter={event => {
        if (event.dataTransfer.types.includes('Files')) {
          showInputMode('upload')
        }
      }}
    >
      <ToggleButtonGroup
        color="primary"
        size="small"
        exclusive
        value={inputMode}
        onChange={(_event, val: unknown) => {
          if (val === 'paste' || val === 'upload') {
            showInputMode(val)
          }
        }}
      >
        <ToggleButton value="paste">Paste list of files</ToggleButton>
        <ToggleButton value="upload">Drag and drop files</ToggleButton>
      </ToggleButtonGroup>
      {inputMode === 'paste' ? (
        <>
          <TextField
            multiline
            fullWidth
            rows={5}
            value={inputVal}
            placeholder="https://host/sample1.bw"
            helperText={PASTE_HELP}
            variant="outlined"
            onChange={event => {
              update({ inputVal: event.target.value })
            }}
          />
          <Button
            variant="outlined"
            disabled={!inputVal.trim()}
            onClick={addPasted}
          >
            Add tracks
          </Button>
        </>
      ) : (
        <div style={{ width: '100%' }}>
          <FileDropZone
            onDrop={accepted => {
              addClassified(accepted.map(file => classifyFile(file, guessers)))
            }}
          />
        </div>
      )}
      {tracks.length > 0 ? (
        <div style={{ width: '100%' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DeleteIcon />}
            disabled={selectedIds.size === 0}
            onClick={() => {
              update({
                tracks: currentTracks().filter(t => !selectedIds.has(t.id)),
              })
              setTicked(new Set())
            }}
          >
            Delete selected
          </Button>
          <div className={classes.tableBox}>
            <VirtualTable
              rows={sortedTracks}
              columns={columns}
              widths={() => ({ kind: KIND_WIDTH })}
              {...sortProps}
              emptyMessage="No tracks"
              isRowSelected={row => selectedIds.has(row.id)}
              leading={checkboxLeading({
                selected: selectedIds,
                onChange: setTicked,
                label: row => `Select ${coarseStripHTML(row.name)}`,
                allLabel: 'Select all tracks',
              })}
              testId="multi-row-track-list"
            />
          </div>
        </div>
      ) : null}
      {refusalLines.length > 0 ? (
        <Alert severity="warning">
          Left out:
          <ul style={{ margin: 0 }}>
            {refusalLines.map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {kind === 'mixed' ? (
        <Alert severity="error">{MIXED_MESSAGE}</Alert>
      ) : null}
      <TextField
        value={trackName}
        label="Track name"
        variant="outlined"
        fullWidth
        onChange={event => {
          update({ trackName: event.target.value })
        }}
      />
      <AssemblySelector
        session={getSession(model)}
        helperText=""
        selected={model.assembly}
        onChange={arg => {
          model.setAssembly(arg)
        }}
        fullWidth
      />
      <Button
        variant="contained"
        disabled={!canSubmit({ kind, trackName, assembly: model.assembly })}
        onClick={() => {
          try {
            if (kind === 'quantitative' || kind === 'feature') {
              doSubmit({ trackName, tracks: allTracks, kind, model })
            }
          } catch (e) {
            getNotificationSink(model).notifyError(`${e}`, e)
          }
        }}
      >
        Submit
      </Button>
    </Paper>
  )
})

export default MultiRowAddTrackWorkflow
