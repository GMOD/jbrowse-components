import { useState } from 'react'

import { AssemblySelector, ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import { addTrackFromWidget, getSession, makeTrackId } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getRoot } from '@jbrowse/mobx-state-tree'
import { Button, Paper, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import RadioSelector from './RadioSelector.tsx'
import { buildAdapterConfig, parseSampleNames } from './buildAdapterConfig.ts'

import type {
  AdapterTypeOptions,
  IndexTypeOptions,
} from './buildAdapterConfig.ts'
import type {
  AbstractRootModel,
  AddTrackWorkflowModel,
  FileLocation,
} from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(),
    padding: theme.spacing(),
  },
  submit: {
    marginTop: 25,
    marginBottom: 100,
    display: 'block',
  },
}))

const dataFileName: Record<AdapterTypeOptions, string> = {
  BigMafAdapter: 'Path to bigMaf',
  MafTabixAdapter: 'Path to MAF tabix',
  BgzipTaffyAdapter: 'Path to TAF.gz (Bgzipped TAF)',
  BgzipMafAdapter: 'Path to MAF.gz (bgzip-compressed MAF)',
}

// User-facing radio labels; the option values are the internal adapter type
// names, which shouldn't be shown to users directly.
const fileTypeLabel: Record<AdapterTypeOptions, string> = {
  BigMafAdapter: 'bigMaf',
  MafTabixAdapter: 'MAF (tabix-indexed)',
  BgzipTaffyAdapter: 'TAF (Taffy, bgzip-compressed)',
  BgzipMafAdapter: 'MAF (bgzip-compressed, taffy .tai index)',
}

// The `maf2bed --summary` BED, offered by every format whose own read is
// unbounded by zoom. Same wording in all three places it appears, so the file
// being asked for reads the same however the user got here.
const SUMMARY_BED_LABEL =
  'Path to summary BED (.bed.gz from `maf2bed --summary`, optional — enables zoom-out rendering)'

const MultiMAFWidget = observer(function MultiMAFWidget({
  model,
}: {
  model: AddTrackWorkflowModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const [samples, setSamples] = useState('')
  const [loc, setLoc] = useState<FileLocation>()
  const [indexLoc, setIndexLoc] = useState<FileLocation>()
  const [nhLoc, setNhLoc] = useState<FileLocation>()
  const [summaryLoc, setSummaryLoc] = useState<FileLocation>()
  const [framesLoc, setFramesLoc] = useState<FileLocation>()
  const [error, setError] = useState<unknown>()
  const [trackName, setTrackName] = useState('MAF track')
  const [fileTypeChoice, setFileTypeChoice] =
    useState<AdapterTypeOptions>('BigMafAdapter')
  const [indexTypeChoice, setIndexTypeChoice] =
    useState<IndexTypeOptions>('TBI')

  const rootModel = getRoot<AbstractRootModel>(model)

  function handleSubmit() {
    try {
      setError(undefined)
      const name = trackName.trim()
      addTrackFromWidget({
        model,
        session,
        conf: {
          trackId: makeTrackId({ name }),
          type: 'MafTrack',
          name,
          assemblyNames: [model.assembly],
          adapter: buildAdapterConfig({
            fileTypeChoice,
            indexTypeChoice,
            loc,
            indexLoc,
            nhLoc,
            summaryLoc,
            framesLoc,
            sampleNames: parseSampleNames(samples),
          }),
        },
      })
    } catch (e) {
      setError(e)
    }
  }

  return (
    <Paper className={classes.paper}>
      <div>
        {error ? <ErrorMessage error={error} /> : null}
        <RadioSelector
          label="File type"
          value={fileTypeChoice}
          options={[
            'BigMafAdapter',
            'MafTabixAdapter',
            'BgzipTaffyAdapter',
            'BgzipMafAdapter',
          ]}
          getOptionLabel={value => fileTypeLabel[value]}
          onChange={value => {
            setFileTypeChoice(value)
          }}
        />
        <FileSelector
          location={loc}
          name={dataFileName[fileTypeChoice]}
          rootModel={rootModel}
          setLocation={arg => {
            setLoc(arg)
          }}
        />
        {fileTypeChoice === 'BigMafAdapter' ? (
          <FileSelector
            location={summaryLoc}
            name="Path to bigMafSummary (.bb, optional — enables cheap zoom-out rendering)"
            rootModel={rootModel}
            setLocation={arg => {
              setSummaryLoc(arg)
            }}
          />
        ) : fileTypeChoice === 'MafTabixAdapter' ? (
          <>
            <RadioSelector
              label="Index type"
              value={indexTypeChoice}
              options={['TBI', 'CSI']}
              onChange={value => {
                setIndexTypeChoice(value)
              }}
            />
            <FileSelector
              location={indexLoc}
              name="Path to MAF tabix index"
              rootModel={rootModel}
              setLocation={arg => {
                setIndexLoc(arg)
              }}
            />
            {/* Without this the track has no zoom-out view at all: a tabix MAF
                keeps every species' bases on one line, so a wide query pulls
                the whole alignment and the size gate blocks it. The sibling
                .tbi is assumed, as everywhere else in this adapter. */}
            <FileSelector
              location={summaryLoc}
              name={SUMMARY_BED_LABEL}
              rootModel={rootModel}
              setLocation={arg => {
                setSummaryLoc(arg)
              }}
            />
          </>
        ) : (
          <>
            {/* Both remaining formats are bgzip + a taffy `.tai`; they differ
                only in the text inside. TAF names its index required because
                the adapter has no shorthand for it, while BgzipMafAdapter's
                `uri` form already resolves the sibling — so there it is an
                override, not a requirement. */}
            <FileSelector
              location={indexLoc}
              name={
                fileTypeChoice === 'BgzipTaffyAdapter'
                  ? 'Path to TAF.gz.tai (TAF index)'
                  : 'Path to MAF.gz.tai (taffy index, optional — the sibling .tai is assumed)'
              }
              rootModel={rootModel}
              setLocation={arg => {
                setIndexLoc(arg)
              }}
            />
            {/* The .tai bounds a read to the span on screen, which is why this
                was left off at first. Span is only half the cost — the other
                half is depth, and a deep alignment runs out of it whatever the
                index does. Same sibling-.tbi assumption as the tabix branch. */}
            <FileSelector
              location={summaryLoc}
              name={SUMMARY_BED_LABEL}
              rootModel={rootModel}
              setLocation={arg => {
                setSummaryLoc(arg)
              }}
            />
          </>
        )}
      </div>
      <div>
        {/* Format-independent — every MAF adapter takes the frames file as the
            same BigBed sub-adapter — so it sits outside the per-format branch
            above, next to the tree, which is the other file that describes the
            alignment rather than being it. Without it the track menu's "Show
            CDS frames", the codon row coloring and the codon conservation band
            are all unreachable, which is what a UI-added track used to be. */}
        <FileSelector
          location={framesLoc}
          name="Path to CDS frames (UCSC multiz<N>wayFrames.bb, optional — enables the CDS overlay and codon view)"
          rootModel={rootModel}
          setLocation={arg => {
            setFramesLoc(arg)
          }}
        />
        <FileSelector
          location={nhLoc}
          name="Path to newick tree (.nh)"
          rootModel={rootModel}
          setLocation={arg => {
            setNhLoc(arg)
          }}
        />
        <TextField
          multiline
          rows={10}
          value={samples}
          onChange={event => {
            setSamples(event.target.value)
          }}
          helperText="Sample names (optional — taken from the .nh tree, or auto-detected from the file, when left blank)"
          placeholder="Enter sample names from the MAF file, one per line, or JSON formatted array of samples"
          variant="outlined"
          fullWidth
        />
      </div>
      <TextField
        value={trackName}
        helperText="Track name"
        onChange={event => {
          setTrackName(event.target.value)
        }}
      />
      <AssemblySelector
        session={session}
        helperText="Select assembly to add track to"
        selected={model.assembly}
        onChange={arg => {
          model.setAssembly(arg)
        }}
        fullWidth
      />
      <Button
        variant="contained"
        className={classes.submit}
        disabled={!loc || !trackName.trim() || !model.assembly}
        onClick={() => {
          handleSubmit()
        }}
      >
        Submit
      </Button>
    </Paper>
  )
})

export default MultiMAFWidget
