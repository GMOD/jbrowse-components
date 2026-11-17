import { useState } from 'react'

import { FileSelector } from '@jbrowse/core/ui'
import Dialog from '@jbrowse/core/ui/Dialog'
import {
  isBlobLocation,
  isFileHandleLocation,
  isLocalPathLocation,
  isUriLocation,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { SlotFacade } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  files: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}))

const INDEX_SLOTS = new Set([
  'baiLocation',
  'craiLocation',
  'faiLocation',
  'taiLocation',
])

const FORMAT_NAMES: Record<string, string> = {
  bam: 'BAM',
  cram: 'CRAM',
  sam: 'SAM',
  vcf: 'VCF',
  vcfGz: 'VCF',
  bigWig: 'BigWig',
  bigBed: 'BigBed',
  bed: 'BED',
  bedGz: 'BED',
  bedGraph: 'bedGraph',
  bedGraphGz: 'bedGraph',
  bedpe: 'BEDPE',
  gff: 'GFF3',
  gffGz: 'GFF3',
  gtf: 'GTF',
  gtfGz: 'GTF',
  fasta: 'FASTA',
  twoBit: '2bit',
  hic: 'Hi-C',
  paf: 'PAF',
  pifGz: 'PIF',
  delta: 'Delta',
  chain: 'Chain',
  mafGz: 'MAF',
  tafGz: 'TAF',
  chromSizes: 'Chrom sizes',
  nh: 'Newick tree',
}

function sentenceCase(camel: string) {
  const words = camel.replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function fileLabel(path: string[]) {
  const name = path.at(-1) ?? ''
  const stem = name.replace(/Location$/, '')
  return path.includes('index') || INDEX_SLOTS.has(name)
    ? 'Index file'
    : name === 'gziLocation'
      ? 'Index file (.gzi)'
      : `${FORMAT_NAMES[stem] ?? sentenceCase(stem)} file`
}

function storedLocation(value: unknown) {
  return isUriLocation(value) ||
    isLocalPathLocation(value) ||
    isBlobLocation(value) ||
    isFileHandleLocation(value)
    ? value
    : undefined
}

/**
 * The error bar's file fix: each file location of a failing track's adapter,
 * written back on Save as the settings form writes it. "All settings..."
 * opens the whole form for anything else.
 */
const TrackFilesDialog = observer(function TrackFilesDialog({
  trackName,
  slots,
  onSave,
  onAllSettings,
  handleClose,
}: {
  trackName: string
  slots: { path: string[]; slot: SlotFacade }[]
  onSave: () => void
  onAllSettings: () => void
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [edits, setEdits] = useState<Record<string, FileLocation>>({})
  const changed = Object.keys(edits).length > 0
  return (
    <Dialog
      open
      maxWidth="md"
      fullWidth
      title={`Files of ${trackName}`}
      data-testid="track_files_dialog"
      onClose={handleClose}
    >
      <form
        onSubmit={event => {
          event.preventDefault()
          if (changed) {
            for (const { path, slot } of slots) {
              const edit = edits[path.join('.')]
              if (edit) {
                slot.set(edit)
              }
            }
            onSave()
            handleClose()
          }
        }}
      >
        <DialogContent>
          <div className={classes.files}>
            {slots.map(({ path, slot }) => {
              const key = path.join('.')
              return (
                <div key={key}>
                  <FileSelector
                    name={fileLabel(path)}
                    location={edits[key] ?? storedLocation(slot.value)}
                    setLocation={location => {
                      setEdits(prev => ({ ...prev, [key]: location }))
                    }}
                    rootModel={slot.pluginManager.rootModel}
                  />
                </div>
              )
            })}
          </div>
        </DialogContent>
        <DialogActions>
          <Button
            sx={{ mr: 'auto' }}
            onClick={() => {
              onAllSettings()
              handleClose()
            }}
          >
            All settings...
          </Button>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!changed}>
            Save
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
})

export default TrackFilesDialog
