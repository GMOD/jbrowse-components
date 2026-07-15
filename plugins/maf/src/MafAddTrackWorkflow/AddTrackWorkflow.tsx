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
import { Button, Paper, TextField } from '@mui/material'

import RadioSelector from './RadioSelector.tsx'
import { buildAdapterConfig, parseSampleNames } from './buildAdapterConfig.ts'

import type {
  AdapterTypeOptions,
  IndexTypeOptions,
} from './buildAdapterConfig.ts'
import type { AbstractRootModel, FileLocation } from '@jbrowse/core/util'
import type { AddTrackModel } from '@jbrowse/plugin-data-management'

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
}

export default function MultiMAFWidget({ model }: { model: AddTrackModel }) {
  const { classes } = useStyles()
  const [samples, setSamples] = useState('')
  const [loc, setLoc] = useState<FileLocation>()
  const [indexLoc, setIndexLoc] = useState<FileLocation>()
  const [nhLoc, setNhLoc] = useState<FileLocation>()
  const [summaryLoc, setSummaryLoc] = useState<FileLocation>()
  const [error, setError] = useState<unknown>()
  const [trackName, setTrackName] = useState('MAF track')
  const [fileTypeChoice, setFileTypeChoice] =
    useState<AdapterTypeOptions>('BigMafAdapter')
  const [indexTypeChoice, setIndexTypeChoice] =
    useState<IndexTypeOptions>('TBI')

  const rootModel = getRoot<AbstractRootModel>(model)

  function handleSubmit() {
    try {
      const session = getSession(model)
      const sampleNames = parseSampleNames(samples)
      const trackId = makeTrackId({ name: trackName })
      if (isSessionWithAddTracks(session)) {
        addAndShowTrack(
          session,
          {
            trackId,
            type: 'MafTrack',
            name: trackName,
            assemblyNames: [model.assembly],
            adapter: buildAdapterConfig({
              fileTypeChoice,
              indexTypeChoice,
              loc,
              indexLoc,
              nhLoc,
              summaryLoc,
              sampleNames,
            }),
          },
          model.view,
        )
      }
      model.clearData()
      if (isSessionModelWithWidgets(session)) {
        session.hideWidget(model)
      }
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
          options={['BigMafAdapter', 'MafTabixAdapter', 'BgzipTaffyAdapter']}
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
          </>
        ) : (
          <FileSelector
            location={indexLoc}
            name="Path to TAF.gz.tai (TAF index)"
            rootModel={rootModel}
            setLocation={arg => {
              setIndexLoc(arg)
            }}
          />
        )}
      </div>
      <div>
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
      <Button
        variant="contained"
        className={classes.submit}
        onClick={() => {
          handleSubmit()
        }}
      >
        Submit
      </Button>
    </Paper>
  )
}
