import React, { useState } from 'react'

import { ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import {
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
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

export default function MultiMAFWidget({ model }: { model: AddTrackModel }) {
  const { classes } = useStyles()
  const [samples, setSamples] = useState('')
  const [loc, setLoc] = useState<FileLocation>()
  const [indexLoc, setIndexLoc] = useState<FileLocation>()
  const [nhLoc, setNhLoc] = useState<FileLocation>()
  const [error, setError] = useState<unknown>()
  const [trackName, setTrackName] = useState('MAF track')
  const [fileTypeChoice, setFileTypeChoice] =
    useState<AdapterTypeOptions>('BigMafAdapter')
  const [indexTypeChoice, setIndexTypeChoice] =
    useState<IndexTypeOptions>('TBI')

  const rootModel = getRoot<AbstractRootModel>(model)
  return (
    <Paper className={classes.paper}>
      <Paper>
        {error ? <ErrorMessage error={error} /> : null}
        <RadioSelector
          label="File type"
          value={fileTypeChoice}
          options={['BigMafAdapter', 'MafTabixAdapter', 'BgzipTaffyAdapter']}
          onChange={value => {
            setFileTypeChoice(value)
          }}
        />
        {fileTypeChoice === 'BigMafAdapter' ? (
          <FileSelector
            location={loc}
            name="Path to bigMaf"
            rootModel={rootModel}
            setLocation={arg => {
              setLoc(arg)
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
              location={loc}
              name="Path to MAF tabix"
              rootModel={rootModel}
              setLocation={arg => {
                setLoc(arg)
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
          <>
            <FileSelector
              location={loc}
              name="Path to TAF.gz (Bgzipped TAF)"
              rootModel={rootModel}
              setLocation={arg => {
                setLoc(arg)
              }}
            />
            <FileSelector
              location={indexLoc}
              name="Path to TAF.gz.tai (TAF index)"
              rootModel={rootModel}
              setLocation={arg => {
                setIndexLoc(arg)
              }}
            />
          </>
        )}
      </Paper>
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
          helperText="Sample names (optional if .nh supplied, required if not)"
          placeholder={
            'Enter sample names from the MAF file, one per line, or JSON formatted array of samples'
          }
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
          try {
            const session = getSession(model)
            const sampleNames = parseSampleNames(samples)
            if (!sampleNames.length && !nhLoc) {
              throw new Error(
                'Please supply sample names or a newick tree (.nh) file',
              )
            }
            const safeName = trackName.toLowerCase().replaceAll(' ', '_')
            const sessionSuffix = session.adminMode ? '' : '-sessionTrack'
            const trackId = `${safeName}-${Date.now()}${sessionSuffix}`

            if (isSessionWithAddTracks(session)) {
              session.addTrackConf({
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
                  sampleNames,
                }),
              })
              model.view?.showTrack(trackId)
            }
            model.clearData()
            if (isSessionModelWithWidgets(session)) {
              session.hideWidget(model)
            }
          } catch (e) {
            setError(e)
          }
        }}
      >
        Submit
      </Button>
    </Paper>
  )
}
