import { useState } from 'react'

import { AssemblySelector, ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import {
  addTrackFromWidget,
  getEnv,
  getSession,
  makeTrackId,
  workflowForm,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Paper, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import RadioSelector from './RadioSelector.tsx'
import { buildAdapterConfig, parseSampleNames } from './buildAdapterConfig.ts'
import { MAF_WORKFLOW } from './workflowName.ts'

import type {
  AdapterTypeOptions,
  IndexTypeOptions,
} from './buildAdapterConfig.ts'
import type { AddTrackWorkflowModel, FileLocation } from '@jbrowse/core/util'

interface MafForm {
  samples: string
  loc?: FileLocation
  indexLoc?: FileLocation
  nhLoc?: FileLocation
  summaryLoc?: FileLocation
  framesLoc?: FileLocation
  trackName: string
  fileTypeChoice: AdapterTypeOptions
  indexTypeChoice: IndexTypeOptions
}

const initialForm: MafForm = {
  samples: '',
  trackName: 'MAF track',
  fileTypeChoice: 'BigMafAdapter',
  indexTypeChoice: 'TBI',
}

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(),
    padding: theme.spacing(),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  },
  file: {
    width: '100%',
  },
}))

const dataFileName: Record<AdapterTypeOptions, string> = {
  BigMafAdapter: 'bigMaf file',
  MafTabixAdapter: 'MAF tabix file',
  BgzipTaffyAdapter: 'TAF.gz file',
  BgzipMafAdapter: 'MAF.gz file',
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
const SUMMARY_BED = {
  name: 'Summary BED',
  description:
    'Optional. The .bed.gz from `maf2bed --summary`, which draws the zoomed-out view.',
}

const MultiMAFWidget = observer(function MultiMAFWidget({
  model,
}: {
  model: AddTrackWorkflowModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { form, update } = workflowForm(model, MAF_WORKFLOW, initialForm)
  const {
    samples,
    loc,
    indexLoc,
    nhLoc,
    summaryLoc,
    framesLoc,
    trackName,
    fileTypeChoice,
    indexTypeChoice,
  } = form
  const [error, setError] = useState<unknown>()

  const { rootModel } = getEnv(model).pluginManager

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
            samples: parseSampleNames(samples),
          }),
        },
      })
    } catch (e) {
      setError(e)
    }
  }

  return (
    <Paper className={classes.paper}>
      <div className={classes.file}>
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
            update({
              fileTypeChoice: value,
              indexLoc: undefined,
              summaryLoc: undefined,
            })
          }}
        />
        <FileSelector
          location={loc}
          name={dataFileName[fileTypeChoice]}
          rootModel={rootModel}
          setLocation={arg => {
            update({ loc: arg })
          }}
        />
        {fileTypeChoice === 'BigMafAdapter' ? (
          <FileSelector
            location={summaryLoc}
            name="bigMafSummary (.bb)"
            description="Optional. Draws the zoomed-out view."
            rootModel={rootModel}
            setLocation={arg => {
              update({ summaryLoc: arg })
            }}
          />
        ) : fileTypeChoice === 'MafTabixAdapter' ? (
          <>
            <RadioSelector
              label="Index type"
              value={indexTypeChoice}
              options={['TBI', 'CSI']}
              onChange={value => {
                update({ indexTypeChoice: value })
              }}
            />
            <FileSelector
              location={indexLoc}
              name="Tabix index"
              description="Optional. Left empty, the index next to the file is used."
              rootModel={rootModel}
              setLocation={arg => {
                update({ indexLoc: arg })
              }}
            />
            {/* Without this the track has no zoom-out view at all: a tabix MAF
                keeps every species' bases on one line, so a wide query pulls
                the whole alignment and the size gate blocks it. The sibling
                .tbi is assumed, as everywhere else in this adapter. */}
            <FileSelector
              location={summaryLoc}
              {...SUMMARY_BED}
              rootModel={rootModel}
              setLocation={arg => {
                update({ summaryLoc: arg })
              }}
            />
          </>
        ) : (
          <>
            {/* Both remaining formats are bgzip + a taffy `.tai`, and both
                adapters' `uri` shorthands resolve the same sibling — so the
                picker is an override for an index that is not one, and they
                differ only in the file name the label quotes. */}
            <FileSelector
              location={indexLoc}
              name="Taffy index (.tai)"
              description="Optional. Left empty, the .tai next to the file is used."
              rootModel={rootModel}
              setLocation={arg => {
                update({ indexLoc: arg })
              }}
            />
            {/* The .tai bounds a read to the span on screen, which is why this
                was left off at first. Span is only half the cost — the other
                half is depth, and a deep alignment runs out of it whatever the
                index does. Same sibling-.tbi assumption as the tabix branch. */}
            <FileSelector
              location={summaryLoc}
              {...SUMMARY_BED}
              rootModel={rootModel}
              setLocation={arg => {
                update({ summaryLoc: arg })
              }}
            />
          </>
        )}
      </div>
      <div className={classes.file}>
        {/* Format-independent — every MAF adapter takes the frames file as the
            same BigBed sub-adapter — so it sits outside the per-format branch
            above, next to the tree, which is the other file that describes the
            alignment rather than being it. Without it the track menu's "Show
            CDS frames", the codon row coloring and the codon conservation band
            are all unreachable, which is what a UI-added track used to be. */}
        <FileSelector
          location={framesLoc}
          name="CDS frames (.bb)"
          description="Optional. A UCSC multiz<N>wayFrames.bb, for the CDS overlay and codon view."
          rootModel={rootModel}
          setLocation={arg => {
            update({ framesLoc: arg })
          }}
        />
        <FileSelector
          location={nhLoc}
          name="Newick tree (.nh)"
          description="Optional."
          rootModel={rootModel}
          setLocation={arg => {
            update({ nhLoc: arg })
          }}
        />
        <TextField
          multiline
          minRows={2}
          maxRows={10}
          label="Sample names"
          value={samples}
          onChange={event => {
            update({ samples: event.target.value })
          }}
          helperText="Optional. One per line, or a JSON array. Left empty, they come from the tree or the file."
          variant="outlined"
          fullWidth
        />
      </div>
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
        session={session}
        helperText=""
        selected={model.assembly}
        onChange={arg => {
          model.setAssembly(arg)
        }}
        fullWidth
      />
      <Button
        variant="contained"
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
