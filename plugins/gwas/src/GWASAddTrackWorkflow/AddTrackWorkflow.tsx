import { useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import {
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getRoot } from '@jbrowse/mobx-state-tree'
import { Button, Divider, Paper, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { locationName } from './ldAdapterConfig.ts'
import { buildGwasTrackConfig, canSubmit, makeTrackId } from './util.ts'

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
  const [scoreColumn, setScoreColumn] = useState('neg_log_pvalue')
  const [ldLocation, setLdLocation] = useState<FileLocation>()
  const [ldIndexLocation, setLdIndexLocation] = useState<FileLocation>()
  const [trackName, setTrackName] = useState(() => `GWAS${Date.now()}`)
  const [displayId] = useState(() => `gwas-ld-display-${Date.now()}`)

  const { assembly } = model
  const ldIsTabix = !!ldLocation && locationName(ldLocation).endsWith('.gz')

  function doSubmit() {
    if (gwasLocation && assembly && isSessionWithAddTracks(session)) {
      const trackId = makeTrackId(trackName, !!session.adminMode)
      session.addTrackConf(
        buildGwasTrackConfig({
          trackId,
          trackName,
          assembly,
          gwasLocation,
          gwasIndexLocation,
          scoreColumn,
          ldLocation,
          ldIndexLocation,
          displayId,
        }),
      )
      model.view?.showTrack(trackId)
      model.clearData()
      if (isSessionModelWithWidgets(session)) {
        session.hideWidget(model)
      }
    }
  }

  return (
    <Paper className={classes.paper}>
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
          name="GWAS tabix index (.tbi, optional — defaults to <file>.tbi)"
          location={gwasIndexLocation}
          rootModel={rootModel}
          setLocation={loc => {
            setGwasIndexLocation(loc)
          }}
        />
        <TextField
          label="Score column"
          helperText="BED column to read as the Manhattan score (e.g. 'neg_log_pvalue', 'pvalue')"
          value={scoreColumn}
          onChange={e => {
            setScoreColumn(e.target.value)
          }}
          fullWidth
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
            name="LD tabix index (.tbi, optional — defaults to <file>.tbi)"
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
        disabled={!canSubmit({ gwasLocation, trackName, assembly })}
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
