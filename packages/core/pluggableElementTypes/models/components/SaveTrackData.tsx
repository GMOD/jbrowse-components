import React, { useEffect, useState } from 'react'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'
import { saveAs } from 'file-saver'
import { observer } from 'mobx-react'
import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import {
  getSession,
  getContainingView,
  Feature,
  Region,
  AbstractTrackModel,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'

// icons
import GetAppIcon from '@mui/icons-material/GetApp'

// locals
import { stringifyGFF3 } from './gff3'
import { stringifyGenbank } from './genbank'
import { stringifyBED } from './bed'

const useStyles = makeStyles()({
  root: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

async function fetchFeatures(
  track: IAnyStateTreeNode,
  regions: Region[],
  signal?: AbortSignal,
) {
  const { rpcManager } = getSession(track)
  const adapterConfig = getConf(track, ['adapter'])
  const sessionId = 'getFeatures'
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
    sessionId,
    signal,
  }) as Promise<Feature[]>
}

const SaveTrackDataDialog = observer(function ({
  model,
  handleClose,
}: {
  model: AbstractTrackModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [error, setError] = useState<unknown>()
  const [features, setFeatures] = useState<Feature[]>()
  const [type, setType] = useState('gff3')
  const [str, setStr] = useState('')
  const options = {
    gff3: { name: 'GFF3', extension: 'gff3' },
    genbank: { name: 'GenBank', extension: 'gbk' },
    bed: { name: 'BED', extension: 'bed' },
  }

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const view = getContainingView(model) as { visibleRegions?: Region[] }
        setError(undefined)
        setFeatures(await fetchFeatures(model, view.visibleRegions || []))
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
  }, [model])

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const view = getContainingView(model)
        const session = getSession(model)
        if (!features) {
          return
        }

        if (type === 'gff3') {
          setStr(stringifyGFF3({ features }))
        } else if (type === 'bed') {
          setStr(stringifyBED({ features }))
        } else if (type === 'gb') {
          setStr(
            await stringifyGenbank({
              features,
              session,
              assemblyName: view.visibleRegions[0].assemblyName,
            }),
          )
        } else {
          setStr('Unknown file type')
        }
      } catch (e) {
        setError(e)
      }
    })()
  }, [type, features, model])

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Save track data">
      <DialogContent className={classes.root}>
        {error ? <ErrorMessage error={error} /> : null}
        {!features ? (
          <LoadingEllipses />
        ) : !features.length ? (
          <Typography>No features found</Typography>
        ) : null}

        <FormControl>
          <FormLabel>File type</FormLabel>
          <RadioGroup value={type} onChange={e => setType(e.target.value)}>
            {Object.entries(options).map(([key, val]) => (
              <FormControlLabel
                key={key}
                value={key}
                control={<Radio />}
                label={val.name}
              />
            ))}
          </RadioGroup>
        </FormControl>
        <TextField
          variant="outlined"
          multiline
          minRows={5}
          maxRows={15}
          fullWidth
          value={
            str.length > 100_000
              ? 'Too large to view here, click "Download" to results to file'
              : str
          }
          InputProps={{
            readOnly: true,
            classes: {
              input: classes.textAreaFont,
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const ext = options[type as keyof typeof options].extension
            const blob = new Blob([str], { type: 'text/plain;charset=utf-8' })
            saveAs(blob, `jbrowse_track_data.${ext}`)
          }}
          startIcon={<GetAppIcon />}
        >
          Download
        </Button>

        <Button variant="contained" type="submit" onClick={() => handleClose()}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SaveTrackDataDialog
