import { useState } from 'react'

import { fileToLocation } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { Alert, Box, Button, TextField, Typography, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { useDropzone } from 'react-dropzone'

import {
  adapterLabels,
  applyClassifiedFiles,
  classifyFilename,
  getFilename,
  isBlank,
  urlTextToLocations,
} from './util.ts'

import type { FormState } from './util.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  dropZone: {
    textAlign: 'center',
    padding: theme.spacing(3),
    borderWidth: 2,
    borderRadius: 4,
    borderStyle: 'dashed',
    cursor: 'pointer',
    display: 'block',
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
  section: {
    marginTop: theme.spacing(2),
  },
}))

function DropArea({ onFiles }: { onFiles: (files: File[]) => void }) {
  const { classes, cx } = useStyles()
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => {
      onFiles(files)
    },
  })
  return (
    <div
      {...getRootProps({
        className: cx(
          classes.dropZone,
          isDragActive ? classes.dropZoneActive : classes.dropZoneInactive,
        ),
      })}
    >
      <input {...getInputProps()} />
      <CloudUploadIcon className={classes.uploadIcon} fontSize="large" />
      <Typography color="text.secondary">
        Drop your sequence file plus any index files (.fai/.gzi) here, or click
        to browse
      </Typography>
    </div>
  )
}

const BulkForm = observer(function BulkForm({
  form,
  setForm,
}: {
  form: FormState
  setForm: (update: (prev: FormState) => FormState) => void
}) {
  const { classes } = useStyles()
  const [dropped, setDropped] = useState<FileLocation[]>([])
  const [urls, setUrls] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  const reclassify = (next: FileLocation[], nextUrls: string) => {
    setForm(f =>
      applyClassifiedFiles(
        f,
        [...next, ...urlTextToLocations(nextUrls)],
        nameTouched,
      ),
    )
  }

  const all = [...dropped, ...urlTextToLocations(urls)]
  const unrecognized = all.filter(
    loc => classifyFilename(getFilename(loc)) === undefined,
  )
  const detected = [
    { label: 'Sequence (FASTA)', loc: form.fastaLocation },
    { label: 'Sequence (2bit)', loc: form.twoBitLocation },
    { label: 'FASTA index (.fai)', loc: form.faiLocation },
    { label: 'Gzip index (.gzi)', loc: form.gziLocation },
    { label: 'Chrom sizes', loc: form.chromSizesLocation },
    { label: 'refName aliases', loc: form.refNameAliasesLocation },
    { label: 'Cytobands', loc: form.cytobandsLocation },
  ].filter(d => !isBlank(d.loc))

  return (
    <>
      <TextField
        label="Assembly name"
        helperText="The assembly name e.g. hg38"
        variant="outlined"
        fullWidth
        value={form.assemblyName}
        onChange={event => {
          setNameTouched(true)
          const { value } = event.target
          setForm(f => ({ ...f, assemblyName: value }))
        }}
      />
      <Box className={classes.section}>
        <DropArea
          onFiles={files => {
            const next = [...dropped, ...files.map(file => fileToLocation(file))]
            setDropped(next)
            reclassify(next, urls)
          }}
        />
      </Box>
      <TextField
        className={classes.section}
        label="...or paste file URLs (one per line)"
        placeholder={
          'https://example.com/hg38.fa.gz\nhttps://example.com/hg38.fa.gz.fai'
        }
        multiline
        minRows={3}
        fullWidth
        value={urls}
        onChange={event => {
          const { value } = event.target
          setUrls(value)
          reclassify(dropped, value)
        }}
      />
      {detected.length ? (
        <Box className={classes.section}>
          <Typography variant="subtitle2">
            Detected ({adapterLabels[form.adapterSelection]}):
          </Typography>
          {detected.map(d => (
            <Typography key={d.label} variant="body2">
              {d.label}: {getFilename(d.loc)}
            </Typography>
          ))}
        </Box>
      ) : null}
      {unrecognized.length ? (
        <Alert severity="warning" className={classes.section}>
          Could not classify:{' '}
          {unrecognized.map(loc => getFilename(loc)).join(', ')}
        </Alert>
      ) : null}
      {all.length ? (
        <Button
          size="small"
          onClick={() => {
            setDropped([])
            setUrls('')
            setNameTouched(false)
            setForm(f => applyClassifiedFiles(f, [], false))
          }}
        >
          Clear
        </Button>
      ) : null}
    </>
  )
})

export default BulkForm
