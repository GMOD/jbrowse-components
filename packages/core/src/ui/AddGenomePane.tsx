import { useState } from 'react'

import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Alert, Button, Link, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import AdvancedOptions from './AdvancedOptions.tsx'
import FileDropZone from './FileDropZone.tsx'
import FileSelector from './FileSelector/FileSelector.tsx'
import SequenceAdapterInputs from './SequenceAdapterInputs.tsx'
import {
  applyClassifiedFiles,
  applyPrimaryFile,
  applyTwoBitFile,
  classifyFilename,
  clearSequenceFiles,
  formHasSequence,
  getFilename,
  isBlank,
  urlTextToLocations,
} from '../util/assemblyConfigUtils.ts'
import { fileToLocation } from '../util/index.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { AdapterType, FormState } from '../util/assemblyConfigUtils.ts'
import type { FileLocation } from '../util/types/index.ts'

type Source = 'files' | 'urls'

const shortAdapterLabels: Record<AdapterType, string> = {
  IndexedFastaAdapter: 'Indexed FASTA',
  BgzipFastaAdapter: 'Compressed FASTA',
  FastaAdapter: 'FASTA',
  TwoBitAdapter: '2bit',
}

const useStyles = makeStyles()(theme => ({
  intro: {
    marginBottom: theme.spacing(1),
  },
  links: {
    marginTop: theme.spacing(1),
    display: 'flex',
    gap: theme.spacing(2),
  },
  recognized: {
    marginTop: theme.spacing(2),
  },
  recognizedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  check: {
    color: theme.palette.success.main,
  },
  filename: {
    flexGrow: 1,
  },
  muted: {
    color: theme.palette.text.secondary,
  },
  name: {
    marginTop: theme.spacing(2),
  },
  advanced: {
    marginTop: theme.spacing(1),
  },
  extras: {
    marginTop: theme.spacing(1),
    color: theme.palette.text.secondary,
  },
}))

// The "More options" expander revealing AdvancedOptions (display name, refName
// aliases, cytobands). Shared by the recognition card and the manual form so the
// optional extras always hide behind the same affordance.
const MoreOptions = observer(function MoreOptions({
  form,
  setForm,
  showMore,
  setShowMore,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  showMore: boolean
  setShowMore: (arg: boolean) => void
}) {
  const { classes } = useStyles()
  return (
    <div className={classes.advanced}>
      <Button
        variant="text"
        size="small"
        startIcon={showMore ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => {
          setShowMore(!showMore)
        }}
      >
        {showMore ? 'Fewer options' : 'More options'}
      </Button>
      {showMore ? <AdvancedOptions form={form} setForm={setForm} /> : null}
    </div>
  )
})

// A required index for the chosen adapter that the drop didn't include, so we
// give the user a place to point at it inline. Plain-FASTA auto-indexing has no
// required input, so it's surfaced as a caption by the caller instead.
const RequiredIndexInputs = observer(function RequiredIndexInputs({
  form,
  setForm,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
}) {
  const { classes } = useStyles()
  const { adapterSelection } = form
  const needsFai =
    (adapterSelection === 'IndexedFastaAdapter' ||
      adapterSelection === 'BgzipFastaAdapter') &&
    isBlank(form.faiLocation)
  const needsGzi =
    adapterSelection === 'BgzipFastaAdapter' && isBlank(form.gziLocation)
  return needsFai || needsGzi ? (
    <div className={classes.advanced}>
      <Alert severity="warning">
        This format needs its index file(s). Add them below.
      </Alert>
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
    </div>
  ) : null
})

// The compact confirmation shown once a sequence is recognized: name (editable),
// a one-line summary of what was detected, and required index inputs. Everything
// else lives behind "More options".
const RecognitionCard = observer(function RecognitionCard({
  form,
  setForm,
  onNameEdit,
  onChangeFile,
  showMore,
  setShowMore,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  onNameEdit: () => void
  onChangeFile: () => void
  showMore: boolean
  setShowMore: (arg: boolean) => void
}) {
  const { classes } = useStyles()
  const primaryLoc = isBlank(form.twoBitLocation)
    ? form.fastaLocation
    : form.twoBitLocation
  const extras = [
    form.faiLocation,
    form.gziLocation,
    form.chromSizesLocation,
    form.refNameAliasesLocation,
    form.cytobandsLocation,
  ].filter(loc => !isBlank(loc))
  const autoIndex = form.adapterSelection === 'FastaAdapter'
  return (
    <div className={classes.recognized}>
      <div className={classes.recognizedRow}>
        <CheckCircleIcon fontSize="small" className={classes.check} />
        <Typography variant="body2" className={classes.filename}>
          <b>{getFilename(primaryLoc)}</b>
          <span className={classes.muted}>
            {' · '}
            {shortAdapterLabels[form.adapterSelection]}
          </span>
        </Typography>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => {
            onChangeFile()
          }}
        >
          change
        </Link>
      </div>

      <TextField
        className={classes.name}
        label="Genome name"
        variant="outlined"
        size="small"
        fullWidth
        value={form.assemblyName}
        onChange={event => {
          onNameEdit()
          const { value } = event.target
          setForm(f => ({ ...f, assemblyName: value }))
        }}
        slotProps={{ htmlInput: { 'data-testid': 'assembly-name' } }}
      />

      {extras.length ? (
        <Typography
          variant="caption"
          component="div"
          className={classes.extras}
        >
          Also loading: {extras.map(getFilename).join(', ')}
        </Typography>
      ) : null}

      {autoIndex ? (
        <Typography
          variant="caption"
          component="div"
          className={classes.extras}
        >
          A FASTA index will be built on open (may take a minute for large or
          remote files).
        </Typography>
      ) : null}

      <RequiredIndexInputs form={form} setForm={setForm} />

      <MoreOptions
        form={form}
        setForm={setForm}
        showMore={showMore}
        setShowMore={setShowMore}
      />
    </div>
  )
})

// The escape hatch: pick the format and every file slot by hand, for assemblies
// whose filenames don't follow the conventions we auto-detect.
const ManualEntry = observer(function ManualEntry({
  form,
  setForm,
  showMore,
  setShowMore,
  onBack,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  showMore: boolean
  setShowMore: (arg: boolean) => void
  onBack: () => void
}) {
  const { classes } = useStyles()
  return (
    <>
      <TextField
        label="Genome name"
        helperText="The genome name e.g. hg38"
        variant="outlined"
        fullWidth
        value={form.assemblyName}
        onChange={event => {
          const { value } = event.target
          setForm(f => ({ ...f, assemblyName: value }))
        }}
        slotProps={{ htmlInput: { 'data-testid': 'assembly-name' } }}
      />
      <SequenceAdapterInputs
        form={form}
        setForm={setForm}
        setPrimaryFile={(loc: FileLocation) => {
          setForm(f => applyPrimaryFile(f, loc))
        }}
        setTwoBitFile={(loc: FileLocation) => {
          setForm(f => applyTwoBitFile(f, loc))
        }}
      />
      <MoreOptions
        form={form}
        setForm={setForm}
        showMore={showMore}
        setShowMore={setShowMore}
      />
      <div className={classes.links}>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={() => {
            onBack()
          }}
        >
          ← Use automatic file detection
        </Link>
      </div>
    </>
  )
})

// Drop/paste a genome's files, auto-detect the format, and confirm. Falls back
// to a manual format picker when filenames don't match our conventions. Produces
// a FormState the caller turns into an assembly config (desktop indexes plain
// FASTA via faidx; web keeps it unindexed). Pass onStageAnother to allow queuing
// several genomes before submitting (desktop multi-assembly open).
const AddGenomePane = observer(function AddGenomePane({
  form,
  setForm,
  loading = '',
  onStageAnother,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  loading?: string
  onStageAnother?: () => void
}) {
  const { classes } = useStyles()
  const [source, setSource] = useState<Source>('files')
  const [manual, setManual] = useState(false)
  const [dropped, setDropped] = useState<FileLocation[]>([])
  const [urls, setUrls] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [showMore, setShowMore] = useState(false)

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

  const resetInputs = () => {
    setDropped([])
    setUrls('')
    setNameTouched(false)
    setShowMore(false)
  }
  // Swap the sequence file but keep the name/advanced fields the user entered.
  // nameTouched is preserved so a hand-edited name survives the next drop.
  const changeFile = () => {
    setForm(clearSequenceFiles)
    setDropped([])
    setUrls('')
    setShowMore(false)
  }
  const stageAnother = () => {
    onStageAnother?.()
    resetInputs()
  }

  return (
    <>
      {manual ? (
        <ManualEntry
          form={form}
          setForm={setForm}
          showMore={showMore}
          setShowMore={setShowMore}
          onBack={() => {
            setManual(false)
            setShowMore(false)
          }}
        />
      ) : hasSequence ? (
        <>
          <RecognitionCard
            form={form}
            setForm={setForm}
            onNameEdit={() => {
              setNameTouched(true)
            }}
            onChangeFile={() => {
              changeFile()
            }}
            showMore={showMore}
            setShowMore={setShowMore}
          />
          {onStageAnother ? (
            <div className={classes.links}>
              <Link
                component="button"
                type="button"
                variant="body2"
                disabled={!!loading || !form.assemblyName}
                onClick={() => {
                  stageAnother()
                }}
              >
                Add another genome
              </Link>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {source === 'files' ? (
            <FileDropZone
              message="Drop your genome files here — FASTA, .fa.gz, or .2bit, plus any .fai/.gzi index — or click to browse"
              onDrop={files => {
                const next = [...dropped, ...files.map(f => fileToLocation(f))]
                setDropped(next)
                reclassify(next, urls)
              }}
            />
          ) : (
            <>
              <Typography variant="body2" className={classes.intro}>
                Paste a URL to a sequence file (FASTA, .fa.gz, or .2bit), plus
                any index files, one per line. We fill in the rest.
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

          {unrecognized.length ? (
            <Alert
              severity="warning"
              className={classes.intro}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setManual(true)
                    setShowMore(false)
                  }}
                >
                  Enter details manually
                </Button>
              }
            >
              Couldn't place: {unrecognized.map(getFilename).join(', ')}
            </Alert>
          ) : null}

          <div className={classes.links}>
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={() => {
                setSource(source === 'files' ? 'urls' : 'files')
              }}
            >
              {source === 'files' ? 'Open from a URL' : 'Use local files'}
            </Link>
          </div>
        </>
      )}
    </>
  )
})

export default AddGenomePane
