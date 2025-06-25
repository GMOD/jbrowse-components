import { useState } from 'react'

import { ErrorMessage, FileSelector } from '@jbrowse/core/ui'
import {
  FileLocation,
  getSession,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import {
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import { getRoot } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

import type { AddTrackModel } from '@jbrowse/plugin-data-management'

const useStyles = makeStyles()(theme => ({
  textbox: {
    width: '100%',
  },
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

type AdapterTypeOptions =
  | 'BigMafAdapter'
  | 'MafTabixAdapter'
  | 'BgzipTaffyAdapter'
type IndexTypeOptions = 'TBI' | 'CSI'

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

  const rootModel = getRoot<any>(model)
  return (
    <Paper className={classes.paper}>
      <Paper>
        {error ? <ErrorMessage error={error} /> : null}
        <FormControl>
          <FormLabel>File type</FormLabel>
          <RadioGroup
            value={fileTypeChoice}
            onChange={event => {
              setFileTypeChoice(event.target.value as AdapterTypeOptions)
            }}
          >
            {['BigMafAdapter', 'MafTabixAdapter'].map(r => (
              <FormControlLabel
                key={r}
                value={r}
                control={<Radio />}
                checked={fileTypeChoice === r}
                label={r}
              />
            ))}
          </RadioGroup>
        </FormControl>
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
            <FormControl>
              <FormLabel>Index type</FormLabel>
              <RadioGroup
                value={fileTypeChoice}
                onChange={event => {
                  setIndexTypeChoice(event.target.value as IndexTypeOptions)
                }}
              >
                {['TBI', 'CSI'].map(r => (
                  <FormControlLabel
                    key={r}
                    value={r}
                    control={<Radio />}
                    checked={indexTypeChoice === r}
                    label={r}
                  />
                ))}
              </RadioGroup>
            </FormControl>
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
            let sampleNames = [] as string[]
            try {
              sampleNames = JSON.parse(samples)
            } catch (e) {
              sampleNames = samples.split(/\n|\r\n|\r/)
            }

            const trackId = [
              `${trackName.toLowerCase().replaceAll(' ', '_')}-${Date.now()}`,
              session.adminMode ? '' : '-sessionTrack',
            ].join('')

            if (isSessionWithAddTracks(session)) {
              session.addTrackConf({
                trackId,
                type: 'MafTrack',
                name: trackName,
                assemblyNames: [model.assembly],
                adapter:
                  fileTypeChoice === 'BigMafAdapter'
                    ? {
                        type: fileTypeChoice,
                        bigBedLocation: loc,
                        samples: sampleNames,
                        nhLocation: nhLoc,
                      }
                    : fileTypeChoice === 'MafTabixAdapter'
                      ? {
                          type: fileTypeChoice,
                          bedGzLocation: loc,
                          nhLocation: nhLoc,
                          index: {
                            indexType: indexTypeChoice,
                            location: indexLoc,
                          },
                          samples: sampleNames,
                        }
                      : {
                          type: fileTypeChoice,
                          tafGzLocation: loc,
                          taiLocation: indexLoc,
                          nhLocation: nhLoc,
                          samples: sampleNames,
                        },
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
