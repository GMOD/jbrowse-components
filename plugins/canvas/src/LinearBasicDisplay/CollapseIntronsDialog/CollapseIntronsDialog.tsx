import { useState } from 'react'

import { Dialog, LabeledCheckbox, NumberTextField } from '@jbrowse/core/ui'
import { getSession, pluralize, sum, toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isSessionWithMultipleViews } from '@jbrowse/core/util/types'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormGroup,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { getFeatureName } from '../../RenderFeatureDataRPC/labelUtils.ts'
import { isCDS, isExon } from '../../RenderFeatureDataRPC/util.ts'
import {
  collapseIntrons,
  collapsedRegionsFor,
  getSplicedParts,
  replaceIntrons,
  runIntronAction,
} from './util.ts'

import type { CollapseResult } from './util.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const DEFAULT_WINDOW_SIZE = 100
// A sentinel rather than '': MUI renders an empty Select value as a blank input
// instead of its matching row, so the union option would show as no selection.
const ALL_TRANSCRIPTS = '__all_transcripts__'

const useStyles = makeStyles()({
  // display:flex over the FormControl root's inline-flex, so the two fields
  // stack instead of sharing a line in the md-width dialog
  field: {
    display: 'flex',
    marginBottom: 16,
    width: 400,
  },
})

export function collapseSummary(result: CollapseResult, spannedBp: number) {
  if ('error' in result) {
    return result.error
  }
  const { regions } = result
  const shown = sum(regions.map(r => r.end - r.start))
  return `Collapses to ${regions.length} ${pluralize(regions.length, 'region')} — ${toLocale(shown)}bp shown of the ${toLocale(spannedBp)}bp this feature spans`
}

function transcriptLabel(
  transcript: Feature,
  idx: number,
  drawnLabel: string | undefined,
) {
  const parts = getSplicedParts([transcript])
  const exons = parts.filter(isExon).length
  const cds = parts.filter(isCDS).length
  const counted =
    exons > 0
      ? `${exons} ${pluralize(exons, 'exon')}`
      : cds > 0
        ? `${cds} CDS`
        : `${parts.length} ${pluralize(parts.length, 'block')}`
  const length = transcript.get('end') - transcript.get('start')
  const name =
    drawnLabel ?? getFeatureName(transcript) ?? `Transcript ${idx + 1}`
  return `${name} (${counted}, ${toLocale(length)} bp)`
}

const CollapseIntronsDialog = observer(function CollapseIntronsDialog({
  view,
  transcripts,
  assembly,
  handleClose,
  featureId,
  initialTranscriptId,
  transcriptLabels,
  featureName,
  trackId,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  handleClose: () => void
  featureId: string
  initialTranscriptId?: string
  transcriptLabels?: ReadonlyMap<string, string>
  featureName: string
  trackId: string
}) {
  const { classes } = useStyles()
  const preselected = transcripts.find(t => t.id() === initialTranscriptId)
  const [selectedId, setSelectedId] = useState(
    preselected ? preselected.id() : ALL_TRANSCRIPTS,
  )
  const [flip, setFlip] = useState(transcripts[0]?.get('strand') === -1)
  const [soloOnly, setSoloOnly] = useState(true)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
  const canLaunchView = isSessionWithMultipleViews(getSession(view))
  // Always the originally-clicked feature id, even for a specific transcript
  // row: solo is an exact uniqueId match against the id a gene-shaped feature
  // draws from, so a transcript's id would admit nothing and blank the track.
  const soloFeatureId = soloOnly ? featureId : undefined
  const selectedTranscript = transcripts.find(t => t.id() === selectedId)
  const activeTranscripts = selectedTranscript
    ? [selectedTranscript]
    : transcripts
  const label = selectedTranscript
    ? (transcriptLabels?.get(selectedTranscript.id()) ??
      getFeatureName(selectedTranscript) ??
      featureName)
    : featureName
  const result =
    windowSize === undefined
      ? undefined
      : collapsedRegionsFor({
          transcripts: activeTranscripts,
          assembly,
          padding: windowSize,
          flip,
        })
  const regions = result && 'regions' in result ? result.regions : undefined
  const args = regions && {
    view,
    regions,
    trackId,
    soloFeatureId,
    label,
  }
  const spannedBp =
    Math.max(...activeTranscripts.map(t => t.get('end'))) -
    Math.min(...activeTranscripts.map(t => t.get('start')))

  return (
    <Dialog
      open
      maxWidth="md"
      onClose={() => {
        handleClose()
      }}
      title={`Collapse introns of ${featureName}`}
    >
      <DialogContent>
        <DialogContentText component="div">
          <p>
            Select the 'window size', the amount of extra space to include
            around each splice boundary. The default of {DEFAULT_WINDOW_SIZE}bp
            shows {DEFAULT_WINDOW_SIZE}bp of context on either side of every
            exon; 0 shows only the exons themselves.
          </p>
        </DialogContentText>
        {transcripts.length > 1 ? (
          <TextField
            select
            label="Transcript"
            value={selectedId}
            onChange={event => {
              setSelectedId(event.target.value)
            }}
            className={classes.field}
          >
            <MenuItem value={ALL_TRANSCRIPTS}>
              All transcripts ({transcripts.length}) - union of their exons
            </MenuItem>
            {transcripts.map((transcript, idx) => (
              <MenuItem key={transcript.id()} value={transcript.id()}>
                {transcriptLabel(
                  transcript,
                  idx,
                  transcriptLabels?.get(transcript.id()),
                )}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <NumberTextField
          label="Number of bp around splice site to include"
          defaultValue={DEFAULT_WINDOW_SIZE}
          onValueChange={setWindowSize}
          min={0}
          errorText="Must be a non-negative number"
          className={classes.field}
        />
        {/*
          Renders a space while the field is mid-edit rather than unmounting the
          row: a row that comes and goes moves a button between a mousedown and
          its mouseup, which dispatches no click at all.
        */}
        <Typography
          variant="body2"
          color={result && 'error' in result ? 'error' : 'textSecondary'}
          className={classes.field}
        >
          {result ? collapseSummary(result, spannedBp) : ' '}
        </Typography>
        <FormGroup>
          <LabeledCheckbox
            checked={flip}
            onChange={val => {
              setFlip(val)
            }}
            label="Reverse region order (read minus-strand gene 5'→3')"
          />
          <LabeledCheckbox
            checked={soloOnly}
            onChange={val => {
              setSoloOnly(val)
            }}
            label="Show only this feature (hide others in the track)"
          />
        </FormGroup>
        {soloOnly && selectedTranscript ? (
          <Typography variant="body2" color="textSecondary">
            Isolating matches whole features, so the other isoforms of{' '}
            {featureName} still draw wherever they fall inside the kept windows.
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          disabled={!args}
          onClick={() => {
            runIntronAction(args, replaceIntrons, handleClose)
          }}
        >
          Replace current view
        </Button>
        {canLaunchView ? (
          <Button
            variant="contained"
            color="primary"
            disabled={!args}
            onClick={() => {
              runIntronAction(args, collapseIntrons, handleClose)
            }}
          >
            Open in new view
          </Button>
        ) : null}
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
          color="secondary"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default CollapseIntronsDialog
