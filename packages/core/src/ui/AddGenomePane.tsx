import { useState } from 'react'

import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Alert, Button, Link, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  adapterHasSequence,
  applyClassifiedFiles,
  applyPrimaryFile,
  applyTwoBitFile,
  classifyLocations,
  clearSequenceFiles,
  formHasSequence,
  getMissingSidecars,
  isBlank,
  isFormReady,
  isSequenceRole,
  partitionExtraLocations,
  urlTextToLocations,
} from '../util/assemblyConfigUtils.ts'
import { getFileName } from '../util/getFileName.ts'
import { fileToLocation } from '../util/index.ts'
import { makeStyles } from '../util/tss-react/index.ts'
import AdvancedOptions from './AdvancedOptions.tsx'
import FileDropZone from './FileDropZone.tsx'
import FileSelector from './FileSelector/FileSelector.tsx'
import { EmptySourceTypeProvider } from './FileSelector/emptySourceType.ts'
import SequenceAdapterInputs from './SequenceAdapterInputs.tsx'

import type { AdapterType, FormState } from '../util/assemblyConfigUtils.ts'
import type { FileLocation } from '../util/types/index.ts'

type Source = 'files' | 'urls'

const shortAdapterLabels: Record<AdapterType, string> = {
  IndexedFastaAdapter: 'Indexed FASTA',
  BgzipFastaAdapter: 'Compressed FASTA',
  FastaAdapter: 'FASTA',
  TwoBitAdapter: '2bit',
  ChromSizesAdapter: 'chrom.sizes, no sequence',
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
  onEdit,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  onEdit: (field: keyof FormState) => void
}) {
  const { classes } = useStyles()
  const missing = getMissingSidecars(form)
  return missing.length ? (
    <div className={classes.advanced}>
      <Alert severity="warning">
        This format needs its index file(s). Add them below.
      </Alert>
      {missing.map(({ field, label }) => (
        <FileSelector
          key={field}
          inline
          name={label}
          location={form[field]}
          setLocation={(loc: FileLocation) => {
            onEdit(field)
            setForm(f => ({ ...f, [field]: loc }))
          }}
        />
      ))}
    </div>
  ) : null
})

// The compact confirmation shown once a sequence is recognized: name (editable),
// a one-line summary of what was detected, and required index inputs. Everything
// else lives behind "More options".
const RecognitionCard = observer(function RecognitionCard({
  form,
  setForm,
  onEdit,
  onChangeFile,
  showMore,
  setShowMore,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
  onEdit: (field: keyof FormState) => void
  onChangeFile: () => void
  showMore: boolean
  setShowMore: (arg: boolean) => void
}) {
  const { classes } = useStyles()
  const primaryLoc = isBlank(form.twoBitLocation)
    ? form.fastaLocation
    : form.twoBitLocation
  const { used, unused } = partitionExtraLocations(form)
  const autoIndex = form.adapterSelection === 'FastaAdapter'
  return (
    <div className={classes.recognized}>
      <div className={classes.recognizedRow}>
        <CheckCircleIcon fontSize="small" className={classes.check} />
        <Typography variant="body2" className={classes.filename}>
          <b>{getFileName(primaryLoc)}</b>
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
          onEdit('assemblyName')
          const { value } = event.target
          setForm(f => ({ ...f, assemblyName: value }))
        }}
        slotProps={{ htmlInput: { 'data-testid': 'assembly-name' } }}
      />

      {used.length ? (
        <Typography
          variant="caption"
          component="div"
          className={classes.extras}
        >
          Also loading: {used.map(loc => getFileName(loc)).join(', ')}
        </Typography>
      ) : null}

      {unused.length ? (
        <Typography
          variant="caption"
          component="div"
          className={classes.extras}
        >
          {shortAdapterLabels[form.adapterSelection]} does not use{' '}
          {unused.map(loc => getFileName(loc)).join(', ')}, so it will be
          ignored.
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

      <RequiredIndexInputs form={form} setForm={setForm} onEdit={onEdit} />

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

// Where the files come from: a drop zone or a box of URLs, with a link to swap
// between them. It stays mounted for the whole flow, including after a sequence
// is recognized, so that more files can be added to the same genome — and so
// that the box someone is typing a URL into cannot be unmounted out from under
// them the moment a prefix of that URL looks like a FASTA.
const SourceInput = observer(function SourceInput({
  source,
  setSource,
  urls,
  setUrls,
  hasSequence,
  onDropFiles,
}: {
  source: Source
  setSource: (arg: Source) => void
  urls: string
  setUrls: (arg: string) => void
  hasSequence: boolean
  onDropFiles: (files: File[]) => void
}) {
  const { classes } = useStyles()
  return (
    <>
      {source === 'files' ? (
        <FileDropZone
          message={
            hasSequence
              ? 'Drop any other files for this genome here — index, refName aliases, cytobands'
              : 'Drop your genome files here — FASTA, .fa.gz, or .2bit, plus any .fai/.gzi index — or click to browse'
          }
          onDrop={onDropFiles}
        />
      ) : (
        <>
          <Typography variant="body2" className={classes.intro}>
            Paste a URL to a sequence file (FASTA, .fa.gz, or .2bit) or a
            .chrom.sizes, plus any index files, one per line. We fill in the
            rest.
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
              setUrls(event.target.value)
            }}
            slotProps={{ htmlInput: { 'data-testid': 'genome-urls' } }}
          />
        </>
      )}
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
  )
})

// What the current file set says about itself: what couldn't be placed, whether
// it holds more than one genome, and what is still missing. Every file that
// arrives is accounted for in one of these — a set that silently produces no
// notice and no recognition card reads as a dead drop zone.
const FileNotices = observer(function FileNotices({
  locations,
  hasSequence,
  canStageAnother,
  onEnterManually,
}: {
  locations: FileLocation[]
  hasSequence: boolean
  canStageAnother: boolean
  onEnterManually: () => void
}) {
  const { classes } = useStyles()
  const classified = classifyLocations(locations)
  const placed = classified.filter(f => f.role).map(f => f.location)
  const unrecognized = classified.filter(f => !f.role).map(f => f.location)
  const sequences = classified.filter(f => isSequenceRole(f.role))
  const primary = sequences.at(-1)?.location
  return (
    <>
      {unrecognized.length ? (
        <Alert
          severity="warning"
          className={classes.intro}
          action={
            <Button color="inherit" size="small" onClick={onEnterManually}>
              Enter details manually
            </Button>
          }
        >
          Couldn't place: {unrecognized.map(loc => getFileName(loc)).join(', ')}
        </Alert>
      ) : null}

      {sequences.length > 1 && primary ? (
        <Alert severity="warning" className={classes.intro}>
          This is more than one genome. The form holds one at a time, so only{' '}
          {getFileName(primary)} is being read
          {canStageAnother
            ? ' — open the rest one at a time with "Add another genome".'
            : '.'}
        </Alert>
      ) : null}

      {!hasSequence && placed.length ? (
        <Alert severity="info" className={classes.intro}>
          Got {placed.map(loc => getFileName(loc)).join(', ')}. Add the sequence
          itself — a FASTA, .fa.gz, or .2bit — to go with it.
        </Alert>
      ) : null}
    </>
  )
})

// What a sequence-free assembly costs, said where the choice is made rather
// than left for the empty track to imply. A .chrom.sizes is the right input for
// a whole-genome or synteny view and the wrong one for everything that reads a
// base, and the two are not obvious from the file itself.
const NoSequenceWarning = observer(function NoSequenceWarning() {
  const { classes } = useStyles()
  return (
    <Alert severity="warning" className={classes.intro}>
      This genome will have no sequence — a <code>.chrom.sizes</code> carries
      reference names and lengths and nothing else. The sequence track and GC
      content draw nothing, CRAM tracks cannot decode without the reference, and
      a feature's DNA or protein sequence is unavailable. Whole-genome and
      synteny views read no bases, which is what the format is for; open a FASTA
      or 2bit instead if you need any of the above.
    </Alert>
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
  onStageAnother?: () => Promise<boolean>
}) {
  const { classes } = useStyles()
  const [source, setSource] = useState<Source>('files')
  const [manual, setManual] = useState(false)
  const [dropped, setDropped] = useState<FileLocation[]>([])
  const [urls, setUrls] = useState('')
  const [showMore, setShowMore] = useState(false)
  // fields the user filled in themselves, which the file set does not overwrite
  const [edited, setEdited] = useState<ReadonlySet<keyof FormState>>(
    () => new Set(),
  )

  const markEdited = (field: keyof FormState) => {
    setEdited(prev => new Set(prev).add(field))
  }
  const reclassify = (next: FileLocation[], nextUrls: string) => {
    setForm(f =>
      applyClassifiedFiles(
        f,
        [...next, ...urlTextToLocations(nextUrls)],
        edited,
      ),
    )
  }

  const all = [...dropped, ...urlTextToLocations(urls)]
  const hasSequence = formHasSequence(form)

  const resetInputs = () => {
    setDropped([])
    setUrls('')
    setEdited(new Set())
    setShowMore(false)
  }
  // Swap the sequence file but keep the name/advanced fields the user entered.
  // A hand-edited name stays marked so it survives the next drop; the sidecars
  // do not, because clearSequenceFiles just blanked them and a mark would stop
  // the replacement file set from filling them back in.
  const changeFile = () => {
    setForm(clearSequenceFiles)
    setDropped([])
    setUrls('')
    setShowMore(false)
    setEdited(prev => new Set([...prev].filter(f => f === 'assemblyName')))
  }
  // The pane's inputs are cleared by the staging actually landing, not by the
  // click: on desktop a plain FASTA is indexed first, which takes as long as it
  // takes and can still fail on a name already in use. Clearing up front left
  // the recognition card describing a genome whose files had vanished from the
  // box, and erased anything typed while the index ran.
  const stageAnother = async () => {
    if (await onStageAnother?.()) {
      resetInputs()
    }
  }

  return (
    <EmptySourceTypeProvider value={source === 'urls' ? 'url' : 'file'}>
      {adapterHasSequence(form.adapterSelection) ? null : <NoSequenceWarning />}
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
      ) : (
        <>
          <SourceInput
            source={source}
            setSource={setSource}
            urls={urls}
            hasSequence={hasSequence}
            setUrls={value => {
              setUrls(value)
              reclassify(dropped, value)
            }}
            onDropFiles={files => {
              const next = [...dropped, ...files.map(f => fileToLocation(f))]
              setDropped(next)
              reclassify(next, urls)
            }}
          />

          <FileNotices
            locations={all}
            hasSequence={hasSequence}
            canStageAnother={!!onStageAnother}
            onEnterManually={() => {
              setManual(true)
              setShowMore(false)
            }}
          />

          {hasSequence ? (
            <>
              <RecognitionCard
                form={form}
                setForm={setForm}
                onEdit={markEdited}
                onChangeFile={() => {
                  changeFile()
                }}
                showMore={showMore}
                setShowMore={setShowMore}
              />
              {onStageAnother ? (
                <div className={classes.links}>
                  <Button
                    variant="text"
                    size="small"
                    // the same gate the caller's submit button uses: staging a
                    // form the config builder will refuse only reports its
                    // internal "FASTA, FAI, and GZI locations are all required"
                    disabled={!!loading || !isFormReady(form)}
                    onClick={() => {
                      void stageAnother()
                    }}
                  >
                    Add another genome
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </EmptySourceTypeProvider>
  )
})

export default AddGenomePane
