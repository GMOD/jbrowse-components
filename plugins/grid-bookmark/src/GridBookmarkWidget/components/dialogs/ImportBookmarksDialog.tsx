import { useState } from 'react'

import {
  AssemblySelector,
  Dialog,
  ErrorBanner,
  FileSelector,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import ImportIcon from '@mui/icons-material/Publish'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import type { GridBookmarkModel } from '../../model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

function guessFileType(header: string) {
  return header.startsWith('chrom') && header.includes('assembly_name')
    ? 'TSV'
    : 'BED'
}

function getBookmarksFromTSVFile(lines: string[]) {
  const dataLines = lines[0]!.startsWith('chrom') ? lines.slice(1) : lines
  return dataLines
    .filter(f => !f.startsWith('#'))
    .map(line => {
      const [refName, start, end, label, assemblyName] = line.split('\t')
      return {
        assemblyName: assemblyName!,
        refName: refName!,
        start: +start!,
        end: +end!,
        label: label === '.' ? undefined : label,
      }
    })
}

function getBookmarksFromBEDFile(lines: string[], selectedAsm: string) {
  return lines
    .filter(f => !f.startsWith('#'))
    .map(line => {
      const [refName, start, end, label] = line.split('\t')
      return {
        assemblyName: selectedAsm,
        refName: refName!,
        start: +start!,
        end: +end!,
        label: label === '.' ? undefined : label,
      }
    })
}

const ImportBookmarksDialog = observer(function ImportBookmarksDialog({
  onClose,
  model,
}: {
  onClose: () => void
  model: GridBookmarkModel
}) {
  const [location, setLocation] = useState<FileLocation>()
  const [error, setError] = useState<unknown>()
  const session = getSession(model)
  const { assemblyNames } = session
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0]!)

  return (
    <Dialog open onClose={onClose} maxWidth="xl" title="Import bookmarks">
      <DialogContent>
        <FileSelector
          location={location}
          setLocation={setLocation}
          name="File"
          description={`Choose a BED or TSV format file to import. Required TSV column headers are "chrom, start, end, label, assembly_name".`}
        />
        <AssemblySelector
          onChange={val => {
            setSelectedAsm(val)
          }}
          helperText="Select the assembly for BED file."
          session={session}
          selected={selectedAsm}
        />
        {error ? <ErrorBanner error={error} /> : null}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          data-testid="dialogImport"
          variant="contained"
          color="primary"
          disabled={!location}
          startIcon={<ImportIcon />}
          onClick={async () => {
            try {
              if (location) {
                const data = await openLocation(location).readFile('utf8')
                const lines = data.split(/\n|\r\n|\r/).filter(f => !!f.trim())
                const fileType = guessFileType(lines[0]!)
                model.importBookmarks(
                  fileType === 'BED'
                    ? getBookmarksFromBEDFile(lines, selectedAsm)
                    : getBookmarksFromTSVFile(lines),
                )
              }
              onClose()
            } catch (e) {
              console.error(e)
              setError(e)
            }
          }}
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  )
})
export default ImportBookmarksDialog
