import { useState } from 'react'

import { Dialog, LabeledCheckbox, NumberTextField } from '@jbrowse/core/ui'
import { getSession, pluralize, sum, toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
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
import { isObservableArray } from 'mobx'
import { observer } from 'mobx-react'

import { getFeatureName } from '../../RenderFeatureDataRPC/labelUtils.ts'
import { isExon } from '../../RenderFeatureDataRPC/util.ts'
import {
  collapseIntrons,
  collapsedRegionsFor,
  getExonsAndCDS,
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
  // display:flex (over the FormControl root's inline-flex) so the two fields
  // stack instead of sharing a line in the md-width dialog
  field: {
    display: 'flex',
    marginBottom: 16,
    width: 400,
  },
})

/**
 * What the window size actually buys, in one line, before either button is
 * clicked.
 *
 * Worth saying because the menu item is gated on the gene having introns at
 * UNPADDED exon gaps: a gene whose introns are all shorter than twice the window
 * size arrives here, collapses to a single region, and reported "Introns
 * collapsed" having collapsed nothing. And the ways there is nothing to collapse
 * at all used to be exceptions thrown out of a button handler into a snackbar,
 * after this dialog had closed — so they are said here instead, while the reader
 * can still change the window size or the scope.
 */
export function collapseSummary(result: CollapseResult, spannedBp: number) {
  if ('error' in result) {
    return result.error
  }
  const { regions } = result
  const shown = sum(regions.map(r => r.end - r.start))
  return `Collapses to ${regions.length} ${pluralize(regions.length, 'region')} — ${toLocale(shown)}bp shown of the ${toLocale(spannedBp)}bp this feature spans`
}

// "EDEN.1 (5 exons, 5,585 bp)" — enough to tell isoforms apart in the dropdown.
// A transcript with no exon rows at all is described by its CDS count, since
// that is then what the collapse actually uses. Unnamed transcripts fall back to
// their position in the list.
function transcriptLabel(transcript: Feature, idx: number) {
  const parts = getExonsAndCDS([transcript])
  const exons = parts.filter(f => isExon(f)).length
  const counted = exons > 0 ? `${exons} exons` : `${parts.length} CDS`
  const length = transcript.get('end') - transcript.get('start')
  const name = getFeatureName(transcript) ?? `Transcript ${idx + 1}`
  return `${name} (${counted}, ${toLocale(length)} bp)`
}

const CollapseIntronsDialog = observer(function CollapseIntronsDialog({
  view,
  transcripts,
  assembly,
  handleClose,
  featureId,
  featureName,
  trackId,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  handleClose: () => void
  featureId: string
  featureName: string
  trackId: string
}) {
  const { classes } = useStyles()
  // ALL_TRANSCRIPTS = the union of every transcript's exons; otherwise a single
  // isoform's id. The context menu already narrows to a clicked transcript, so
  // this is the way to reach an isoform that isn't drawn (gene-glyph mode
  // 'longestCoding').
  const [selectedId, setSelectedId] = useState(ALL_TRANSCRIPTS)
  // default to flipping for a minus-strand gene so it reads 5'->3'
  const [flip, setFlip] = useState(transcripts[0]?.get('strand') === -1)
  // default on: isolate the resulting view's track to this gene so it isn't
  // cluttered by other features overlapping the same locus
  const [soloOnly, setSoloOnly] = useState(true)
  const [windowSize, setWindowSize] = useState<number | undefined>(
    DEFAULT_WINDOW_SIZE,
  )
  // Gates "Open in new view". Deliberately NOT isViewContainer/`'addView' in
  // session`: the embedded react-LGV session has addView too, but it
  // destructively REPLACES its single view, and its `views` getter returns a
  // fresh plain array. An observable `views` array is what actually
  // distinguishes a real multi-view container that can hold an added view.
  const canLaunchView = isObservableArray(getSession(view).views)
  // Always the originally-clicked feature id, even for a specific transcript
  // row: solo is an exact uniqueId match (featureAdmission), and a gene-shaped
  // feature draws from its top-level id, so isolating to a transcript's id
  // would admit nothing and blank the track.
  const soloFeatureId = soloOnly ? featureId : undefined
  const selectedTranscript = transcripts.find(t => t.id() === selectedId)
  const activeTranscripts = selectedTranscript
    ? [selectedTranscript]
    : transcripts
  // names the resulting view: the isoform when one is picked, else the gene
  const label = selectedTranscript
    ? (getFeatureName(selectedTranscript) ?? featureName)
    : featureName
  // The regions both buttons act on, built here rather than inside each action:
  // one build, and the dialog can say what it produced BEFORE anything is
  // clicked. Undefined while the window-size field is invalid.
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
  // What collapsing is measured against: the genomic extent of the scope in play,
  // which for the union of several transcripts is the outermost pair rather than
  // the longest one of them.
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
                {transcriptLabel(transcript, idx)}
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
          A non-breaking space while the field is mid-edit, not an unmounted row:
          the summary sits above two checkboxes and the buttons, and a row that
          comes and goes moves a button between a mousedown and its mouseup, which
          dispatches no click at all.
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
