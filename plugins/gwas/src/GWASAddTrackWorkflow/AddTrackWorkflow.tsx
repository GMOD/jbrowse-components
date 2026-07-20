import { useState } from 'react'

import { ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import {
  addAndShowTrack,
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  makeTrackId,
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
import { isTabixLocation, needsExplicitIndex } from './ldAdapterConfig.ts'
import { buildGwasTrackConfig, canSubmit } from './util.ts'

import type { AbstractRootModel } from '@jbrowse/core/util'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { AddTrackModel } from '@jbrowse/plugin-data-management'

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

const GWASAddTrackWorkflow = observer(function GWASAddTrackWorkflow({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const rootModel = getRoot<AbstractRootModel>(model)
  const [gwasLocation, setGwasLocation] = useState<FileLocation>()
  const [gwasIndexLocation, setGwasIndexLocation] = useState<FileLocation>()
  const [scoreColumn, setScoreColumn] = useState(DEFAULT_SCORE_COLUMN)
  const [scoreTransform, setScoreTransform] = useState(DEFAULT_SCORE_TRANSFORM)
  const [ldLocation, setLdLocation] = useState<FileLocation>()
  const [ldIndexLocation, setLdIndexLocation] = useState<FileLocation>()
  const [trackName, setTrackName] = useState('GWAS track')
  const [error, setError] = useState<unknown>()

  const { assembly } = model
  const ldIsTabix = !!ldLocation && isTabixLocation(ldLocation)
  // Uploaded (blob/file-handle) tabix files have no derivable `<file>.tbi`, so
  // the index must be supplied by hand; a URL or local path derives it.
  const gwasIndexRequired = !!gwasLocation && needsExplicitIndex(gwasLocation)
  const ldIndexRequired =
    !!ldLocation && ldIsTabix && needsExplicitIndex(ldLocation)

  function doSubmit() {
    try {
      setError(undefined)
      if (gwasLocation && assembly && isSessionWithAddTracks(session)) {
        addAndShowTrack(
          session,
          buildGwasTrackConfig({
            trackId: makeTrackId({ name: trackName }),
            trackName,
            assembly,
            gwasLocation,
            gwasIndexLocation,
            scoreColumn,
            scoreTransform,
            ldLocation,
            ldIndexLocation,
          }),
          model.view,
        )
        model.clearData()
        if (isSessionModelWithWidgets(session)) {
          session.hideWidget(model)
        }
      } else {
        throw new Error("Can't add tracks to this session")
      }
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
            setGwasLocation(loc)
          }}
        />
        <FileSelector
          name={
            gwasIndexRequired
              ? 'GWAS tabix index (.tbi, required for uploaded files)'
              : 'GWAS tabix index (.tbi, optional — defaults to <file>.tbi)'
          }
          location={gwasIndexLocation}
          rootModel={rootModel}
          setLocation={loc => {
            setGwasIndexLocation(loc)
          }}
        />
        <ScoreColumnFields
          scoreColumn={scoreColumn}
          setScoreColumn={setScoreColumn}
          scoreTransform={scoreTransform}
          setScoreTransform={setScoreTransform}
        />
      </div>

      <Divider className={classes.section} />

      <div className={classes.section}>
        <Typography variant="subtitle2">
          LD coloring (optional, LocusZoom-style)
        </Typography>
        <FileSelector
          name="PLINK LD file (--r2 output, .ld or bgzipped .ld.gz)"
          location={ldLocation}
          rootModel={rootModel}
          setLocation={loc => {
            setLdLocation(loc)
          }}
        />
        {ldIsTabix ? (
          <FileSelector
            name={
              ldIndexRequired
                ? 'LD tabix index (.tbi, required for uploaded files)'
                : 'LD tabix index (.tbi, optional — defaults to <file>.tbi)'
            }
            location={ldIndexLocation}
            rootModel={rootModel}
            setLocation={loc => {
              setLdIndexLocation(loc)
            }}
          />
        ) : null}
      </div>

      <div className={classes.section}>
        <TextField
          label="Track name"
          value={trackName}
          onChange={e => {
            setTrackName(e.target.value)
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
        onClick={() => {
          doSubmit()
        }}
      >
        Submit
      </Button>
    </Paper>
  )
})

export default GWASAddTrackWorkflow
