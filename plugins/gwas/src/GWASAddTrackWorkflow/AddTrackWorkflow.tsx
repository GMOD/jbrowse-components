import { useState } from 'react'

import { AssemblySelector, ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import {
  addTrackFromWidget,
  getSession,
  makeTrackId,
  workflowForm,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getRoot } from '@jbrowse/mobx-state-tree'
import { Button, Divider, Paper, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ScoreColumnFields from '../GWASAdapter/ScoreColumnFields.tsx'
import {
  DEFAULT_SCORE_COLUMN,
  DEFAULT_SCORE_TRANSFORM,
} from '../GWASAdapter/configSchema.ts'
import { isTabixLocation } from './ldAdapterConfig.ts'
import { buildGwasTrackConfig, canSubmit, requiredIndexes } from './util.ts'
import { GWAS_WORKFLOW } from './workflowName.ts'

import type {
  AbstractRootModel,
  AddTrackWorkflowModel,
} from '@jbrowse/core/util'
import type { FileLocation } from '@jbrowse/core/util/types'

interface GwasForm {
  gwasLocation?: FileLocation
  gwasIndexLocation?: FileLocation
  scoreColumn: string
  scoreTransform: string
  ldLocation?: FileLocation
  ldIndexLocation?: FileLocation
  trackName: string
}

const initialForm: GwasForm = {
  scoreColumn: DEFAULT_SCORE_COLUMN,
  scoreTransform: DEFAULT_SCORE_TRANSFORM,
  trackName: 'GWAS track',
}

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(),
    padding: theme.spacing(),
  },
  section: {
    marginTop: theme.spacing(2),
  },
  submit: {
    marginTop: theme.spacing(3),
    display: 'block',
  },
}))

function indexLabel(file: string, required: boolean) {
  return `${file} tabix index (.tbi or .csi, ${required ? 'required for uploaded files' : 'optional — defaults to <file>.tbi'})`
}

const GWASAddTrackWorkflow = observer(function GWASAddTrackWorkflow({
  model,
}: {
  model: AddTrackWorkflowModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const rootModel = getRoot<AbstractRootModel>(model)
  const { form, update } = workflowForm(model, GWAS_WORKFLOW, initialForm)
  const {
    gwasLocation,
    gwasIndexLocation,
    scoreColumn,
    scoreTransform,
    ldLocation,
    ldIndexLocation,
    trackName,
  } = form
  const [error, setError] = useState<unknown>()

  const { assembly } = model
  const ldIsTabix = !!ldLocation && isTabixLocation(ldLocation)
  const required = requiredIndexes(gwasLocation, ldLocation)

  function doSubmit() {
    try {
      setError(undefined)
      if (!gwasLocation || !assembly) {
        throw new Error('Please supply a GWAS file and an assembly')
      }
      const name = trackName.trim()
      addTrackFromWidget({
        model,
        session,
        conf: buildGwasTrackConfig({
          trackId: makeTrackId({ name }),
          trackName: name,
          assembly,
          gwasLocation,
          gwasIndexLocation,
          scoreColumn,
          scoreTransform,
          ldLocation,
          ldIndexLocation,
        }),
      })
    } catch (e) {
      setError(e)
    }
  }

  return (
    <Paper className={classes.paper}>
      {error ? <ErrorMessage error={error} /> : null}
      <Typography variant="h6">Add a GWAS / Manhattan track</Typography>
      <Typography variant="body2" color="textSecondary">
        Load a bgzipped + tabix-indexed BED of GWAS results. Optionally attach a
        PLINK LD file to color points by r² to an index SNP, LocusZoom-style.
      </Typography>

      <div className={classes.section}>
        <Typography variant="subtitle2">GWAS data (required)</Typography>
        <FileSelector
          name="GWAS file (bgzipped BED, e.g. .bed.gz)"
          location={gwasLocation}
          rootModel={rootModel}
          setLocation={loc => {
            update({ gwasLocation: loc })
          }}
        />
        <FileSelector
          name={indexLabel('GWAS', required.gwas)}
          location={gwasIndexLocation}
          rootModel={rootModel}
          setLocation={loc => {
            update({ gwasIndexLocation: loc })
          }}
        />
        <ScoreColumnFields
          scoreColumn={scoreColumn}
          setScoreColumn={arg => {
            update({ scoreColumn: arg })
          }}
          scoreTransform={scoreTransform}
          setScoreTransform={arg => {
            update({ scoreTransform: arg })
          }}
        />
      </div>

      <Divider className={classes.section} />

      <div className={classes.section}>
        <Typography variant="subtitle2">
          LD coloring (optional, LocusZoom-style)
        </Typography>
        <FileSelector
          name="PLINK LD table (.ld or .vcor, bgzipped or not)"
          location={ldLocation}
          rootModel={rootModel}
          setLocation={loc => {
            update({ ldLocation: loc })
          }}
        />
        {ldIsTabix ? (
          <FileSelector
            name={indexLabel('LD', required.ld)}
            location={ldIndexLocation}
            rootModel={rootModel}
            setLocation={loc => {
              update({ ldIndexLocation: loc })
            }}
          />
        ) : null}
      </div>

      <div className={classes.section}>
        <TextField
          label="Track name"
          value={trackName}
          onChange={e => {
            update({ trackName: e.target.value })
          }}
          fullWidth
        />
        <AssemblySelector
          session={session}
          helperText="Select assembly to add track to"
          selected={assembly}
          onChange={arg => {
            model.setAssembly(arg)
          }}
          fullWidth
        />
      </div>

      <Button
        variant="contained"
        className={classes.submit}
        disabled={
          !canSubmit({
            gwasLocation,
            gwasIndexLocation,
            ldLocation,
            ldIndexLocation,
            trackName,
            assembly,
          })
        }
        onClick={doSubmit}
      >
        Submit
      </Button>
    </Paper>
  )
})

export default GWASAddTrackWorkflow
