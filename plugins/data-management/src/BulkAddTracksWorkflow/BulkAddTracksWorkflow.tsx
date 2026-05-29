import { useMemo, useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import {
  getSession,
  isElectron,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { storeBlobLocation } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import {
  Button,
  FormControlLabel,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
} from '@mui/material'
import { observer } from 'mobx-react'
import { useDropzone } from 'react-dropzone'

import { buildTrackConfigs } from './buildConfigs.ts'
import { pairLocations } from './pairLocations.ts'

import type { AddTrackModel } from '../AddTrackWidget/model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  paper: {
    margin: theme.spacing(1),
    padding: theme.spacing(2),
  },
  section: {
    marginTop: theme.spacing(2),
  },
  dropZone: {
    textAlign: 'center',
    padding: theme.spacing(2),
    borderWidth: 2,
    borderRadius: 2,
    borderStyle: 'dashed',
    outline: 'none',
    transition: 'border .24s ease-in-out, background-color .24s ease-in-out',
  },
  dropZoneActive: {
    borderColor: theme.palette.secondary.light,
    backgroundColor: alpha(
      theme.palette.text.primary,
      theme.palette.action.hoverOpacity,
    ),
  },
  dropZoneInactive: {
    borderColor: theme.palette.divider,
    backgroundColor: theme.palette.background.default,
  },
  uploadIcon: {
    color: theme.palette.text.secondary,
  },
  submit: {
    marginTop: theme.spacing(2),
    display: 'block',
  },
  unrecognized: {
    color: theme.palette.error.main,
  },
}))

function fileToLocation(file: File): FileLocation {
  if (isElectron) {
    return {
      // @ts-ignore - electron injects require onto window, needs to be ignore not expect-error for now
      localPath: window.require('electron').webUtils.getPathForFile(file),
      locationType: 'LocalPathLocation',
    }
  } else {
    const loc = storeBlobLocation({ blob: file })
    if ('blobId' in loc) {
      return loc
    }
    throw new Error('could not store file as a blob location')
  }
}

const BulkAddTracksWorkflow = observer(function BulkAddTracksWorkflow({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes, cx } = useStyles()
  const session = getSession(model)
  const adminMode = !!session.adminMode

  const [mode, setMode] = useState<'remote' | 'local'>('remote')
  const [text, setText] = useState('')
  const [localLocations, setLocalLocations] = useState<FileLocation[]>([])
  const [assembly, setAssembly] = useState(model.assembly ?? '')
  const [customNames, setCustomNames] = useState<Record<string, string>>({})
  const [removed, setRemoved] = useState<Record<string, boolean>>({})
  const [timestamp] = useState(() => Date.now())

  const remoteLocations = useMemo<FileLocation[]>(
    () =>
      text
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map(uri => ({ uri, locationType: 'UriLocation' })),
    [text],
  )

  const locations = mode === 'remote' ? remoteLocations : localLocations

  const rows = useMemo(
    () =>
      buildTrackConfigs({
        pairs: pairLocations(locations),
        model,
        assembly,
        adminMode,
        timestamp,
      }),
    [locations, model, assembly, adminMode, timestamp],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: accepted => {
      setLocalLocations(prev => [...prev, ...accepted.map(fileToLocation)])
    },
  })

  const visibleRows = rows.filter(row => !removed[row.id])
  const okRows = visibleRows.filter(row => row.status === 'ok')

  function doSubmit() {
    if (isSessionWithAddTracks(session)) {
      for (const row of okRows) {
        const conf = { ...row.conf, name: customNames[row.id] ?? row.name }
        session.addTrackConf(conf)
        model.view?.showTrack(conf.trackId)
      }
      model.clearData()
      if (isSessionModelWithWidgets(session)) {
        session.hideWidget(model)
      }
    }
  }

  return (
    <Paper className={classes.paper}>
      <Typography variant="h6">Add multiple tracks</Typography>
      <Typography variant="body2" color="textSecondary">
        Paste a list of file URLs or drop a set of local files. Track types are
        auto-detected and index files (e.g. .bai, .tbi) are paired with their
        data file automatically.
      </Typography>

      <RadioGroup
        row
        className={classes.section}
        value={mode}
        onChange={event => {
          setMode(event.target.value === 'local' ? 'local' : 'remote')
        }}
      >
        <FormControlLabel value="remote" control={<Radio />} label="Remote URLs" />
        <FormControlLabel value="local" control={<Radio />} label="Local files" />
      </RadioGroup>

      {mode === 'remote' ? (
        <TextField
          className={classes.section}
          label="File URLs (one per line)"
          placeholder={'https://example.com/a.bam\nhttps://example.com/a.bam.bai'}
          multiline
          minRows={4}
          fullWidth
          value={text}
          onChange={event => {
            setText(event.target.value)
          }}
        />
      ) : (
        <div className={classes.section}>
          <div
            {...getRootProps({
              className: cx(
                classes.dropZone,
                isDragActive
                  ? classes.dropZoneActive
                  : classes.dropZoneInactive,
              ),
            })}
          >
            <input {...getInputProps()} />
            <CloudUploadIcon className={classes.uploadIcon} fontSize="large" />
            <Typography color="text.secondary" align="center">
              Drag and drop files here, or click to browse
            </Typography>
          </div>
          {localLocations.length > 0 ? (
            <Button
              size="small"
              onClick={() => {
                setLocalLocations([])
              }}
            >
              Clear {localLocations.length} file(s)
            </Button>
          ) : null}
        </div>
      )}

      {visibleRows.length > 0 ? (
        <Table className={classes.section} size="small">
          <TableHead>
            <TableRow>
              <TableCell>Track name</TableCell>
              <TableCell>Detected type</TableCell>
              <TableCell>Index</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map(row => (
              <TableRow key={row.id}>
                <TableCell>
                  <TextField
                    variant="standard"
                    fullWidth
                    value={customNames[row.id] ?? row.name}
                    onChange={event => {
                      setCustomNames(prev => ({
                        ...prev,
                        [row.id]: event.target.value,
                      }))
                    }}
                  />
                </TableCell>
                <TableCell>
                  {row.status === 'ok' ? (
                    `${row.trackType} (${row.adapterType})`
                  ) : (
                    <span className={classes.unrecognized}>
                      {row.status === 'unsupported'
                        ? 'Unsupported file type'
                        : 'Unrecognized file type'}
                    </span>
                  )}
                </TableCell>
                <TableCell>{row.indexName ?? 'auto'}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => {
                      setRemoved(prev => ({ ...prev, [row.id]: true }))
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <div className={classes.section}>
        <AssemblySelector
          session={session}
          helperText="Assembly for all added tracks"
          selected={assembly}
          onChange={arg => {
            setAssembly(arg)
          }}
          fullWidth
        />
      </div>

      <Button
        variant="contained"
        color="primary"
        className={classes.submit}
        disabled={okRows.length === 0 || !assembly}
        onClick={() => {
          doSubmit()
        }}
      >
        Add {okRows.length} track(s)
      </Button>
    </Paper>
  )
})

export default BulkAddTracksWorkflow
