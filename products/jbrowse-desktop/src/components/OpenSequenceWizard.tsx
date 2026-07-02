import { useState } from 'react'

import { FileDropZone, FileSelector } from '@jbrowse/core/ui'
import { fileToLocation } from '@jbrowse/core/util'
import {
  adapterLabels,
  applyClassifiedFiles,
  classifyFilename,
  formHasSequence,
  getFilename,
  isBlank,
  urlTextToLocations,
} from '@jbrowse/core/util/assemblyConfigUtils'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Alert,
  Button,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import AdvancedOptions from './AdvancedOptions.tsx'

import type { FormState } from '@jbrowse/core/util/assemblyConfigUtils'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  section: {
    marginTop: theme.spacing(2),
  },
  actions: {
    marginTop: theme.spacing(2),
  },
  button: {
    marginRight: theme.spacing(1),
  },
}))

// The read-only list of files we classified out of the drop/paste, shown on both
// steps so the user can trust what will load without re-reading filenames.
function detectedFiles(form: FormState) {
  return [
    { label: 'Sequence (FASTA)', loc: form.fastaLocation },
    { label: 'Sequence (2bit)', loc: form.twoBitLocation },
    { label: 'FASTA index (.fai)', loc: form.faiLocation },
    { label: 'Gzip index (.gzi)', loc: form.gziLocation },
    { label: 'Chrom sizes', loc: form.chromSizesLocation },
    { label: 'refName aliases', loc: form.refNameAliasesLocation },
    { label: 'Cytobands', loc: form.cytobandsLocation },
  ].filter(d => !isBlank(d.loc))
}

function DetectedSummary({ form }: { form: FormState }) {
  return (
    <div>
      <Typography variant="subtitle2">
        Detected ({adapterLabels[form.adapterSelection]}):
      </Typography>
      {detectedFiles(form).map(d => (
        <Typography key={d.label} variant="body2">
          {d.label}: {getFilename(d.loc)}
        </Typography>
      ))}
    </div>
  )
}

// A required index for the chosen adapter that the drop didn't include, so we
// give the user a place to point at it on the confirm step instead of failing.
function MissingIndexInputs({
  form,
  setForm,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
}) {
  const { adapterSelection } = form
  const needsFai =
    (adapterSelection === 'IndexedFastaAdapter' ||
      adapterSelection === 'BgzipFastaAdapter') &&
    isBlank(form.faiLocation)
  const needsGzi =
    adapterSelection === 'BgzipFastaAdapter' && isBlank(form.gziLocation)
  return (
    <>
      {adapterSelection === 'FastaAdapter' ? (
        <Alert severity="info">
          No FASTA index was found, so one will be generated on open. This might
          take a couple minutes, and a remote file will be downloaded in full.
        </Alert>
      ) : null}
      {needsFai ? (
        <FileSelector
          inline
          name="FASTA index (.fai) file"
          location={form.faiLocation}
          setLocation={(loc: FileLocation) => {
            setForm(f => ({ ...f, faiLocation: loc }))
          }}
        />
      ) : null}
      {needsGzi ? (
        <FileSelector
          inline
          name="FASTA gzip index (.gzi) file"
          location={form.gziLocation}
          setLocation={(loc: FileLocation) => {
            setForm(f => ({ ...f, gziLocation: loc }))
          }}
        />
      ) : null}
    </>
  )
}

const OpenSequenceWizard = observer(function OpenSequenceWizard({
  inputMode,
  form,
  setForm,
  loading,
  onStageAnother,
}: {
  inputMode: 'drop' | 'urls'
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  loading: string
  onStageAnother: () => void
}) {
  const { classes } = useStyles()
  const [activeStep, setActiveStep] = useState(0)
  const [dropped, setDropped] = useState<FileLocation[]>([])
  const [urls, setUrls] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)

  const reclassify = (next: FileLocation[], nextUrls: string) => {
    setForm(f =>
      applyClassifiedFiles(
        f,
        [...next, ...urlTextToLocations(nextUrls)],
        nameTouched,
      ),
    )
  }

  const all = [...dropped, ...urlTextToLocations(urls)]
  const unrecognized = all.filter(
    loc => classifyFilename(getFilename(loc)) === undefined,
  )
  const hasSequence = formHasSequence(form)

  const resetToStart = () => {
    setActiveStep(0)
    setDropped([])
    setUrls('')
    setNameTouched(false)
  }

  return (
    <Stepper activeStep={activeStep} orientation="vertical">
      <Step>
        <StepLabel>Add genome files</StepLabel>
        <StepContent>
          {inputMode === 'drop' ? (
            <>
              <Typography variant="body2" gutterBottom>
                Drop a sequence file (FASTA, .fa.gz, or .2bit) plus any index
                files.
              </Typography>
              <FileDropZone
                message="Drop your genome file here, or click to browse"
                onDrop={files => {
                  const next = [
                    ...dropped,
                    ...files.map(f => fileToLocation(f)),
                  ]
                  setDropped(next)
                  reclassify(next, urls)
                }}
              />
            </>
          ) : (
            <>
              <Typography variant="body2" gutterBottom>
                Paste URLs to a sequence file (FASTA, .fa.gz, or .2bit) plus any
                index files, one per line. We fill in the rest.
              </Typography>
              <TextField
                variant="outlined"
                placeholder={[
                  'https://example.com/hg38.fa.gz',
                  'https://example.com/hg38.fa.gz.fai',
                  'https://example.com/hg38.fa.gz.gzi',
                ].join('\n')}
                multiline
                rows={5}
                fullWidth
                value={urls}
                onChange={event => {
                  const { value } = event.target
                  setUrls(value)
                  reclassify(dropped, value)
                }}
              />
            </>
          )}

          {detectedFiles(form).length ? (
            <div className={classes.section}>
              <DetectedSummary form={form} />
            </div>
          ) : null}
          {unrecognized.length ? (
            <Alert severity="warning" className={classes.section}>
              Could not classify:{' '}
              {unrecognized.map(loc => getFilename(loc)).join(', ')}
            </Alert>
          ) : null}

          <div className={classes.actions}>
            <Button
              variant="contained"
              color="primary"
              className={classes.button}
              disabled={!hasSequence}
              onClick={() => {
                setActiveStep(1)
              }}
            >
              Next
            </Button>
          </div>
        </StepContent>
      </Step>

      <Step>
        <StepLabel>Confirm</StepLabel>
        <StepContent>
          <TextField
            label="Assembly name"
            helperText="Auto-filled from your file — edit if needed"
            variant="outlined"
            fullWidth
            value={form.assemblyName}
            onChange={event => {
              setNameTouched(true)
              const { value } = event.target
              setForm(f => ({ ...f, assemblyName: value }))
            }}
          />

          <div className={classes.section}>
            <DetectedSummary form={form} />
          </div>

          <div className={classes.section}>
            <MissingIndexInputs form={form} setForm={setForm} />
          </div>

          <Button
            variant="text"
            size="small"
            className={classes.section}
            onClick={() => {
              setShowMore(a => !a)
            }}
          >
            {showMore ? 'Fewer options' : 'More options'}
          </Button>
          {showMore ? <AdvancedOptions form={form} setForm={setForm} /> : null}

          <div className={classes.actions}>
            <Button
              className={classes.button}
              disabled={!!loading}
              onClick={() => {
                setActiveStep(0)
              }}
            >
              Back
            </Button>
            <Button
              variant="outlined"
              className={classes.button}
              disabled={!!loading || !form.assemblyName || !hasSequence}
              onClick={() => {
                onStageAnother()
                resetToStart()
              }}
            >
              Add another genome
            </Button>
          </div>
        </StepContent>
      </Step>
    </Stepper>
  )
})

export default OpenSequenceWizard
