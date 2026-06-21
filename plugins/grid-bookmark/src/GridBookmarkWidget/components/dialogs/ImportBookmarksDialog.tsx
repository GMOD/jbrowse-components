import { useState } from 'react'

import {
  AssemblySelector,
  ErrorBanner,
  FileSelector,
  SubmitDialog,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import ImportIcon from '@mui/icons-material/Publish'
import { observer } from 'mobx-react'

import { parseBookmarks } from '../../utils.ts'

import type { GridBookmarkModel } from '../../model.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

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
    <SubmitDialog
      open
      maxWidth="xl"
      title="Import bookmarks"
      submitText="Import"
      submitStartIcon={<ImportIcon />}
      submitDisabled={!location}
      onCancel={onClose}
      onSubmit={async () => {
        try {
          if (location) {
            const data = await openLocation(location).readFile('utf8')
            model.importBookmarks(parseBookmarks(data, selectedAsm))
          }
          onClose()
        } catch (e) {
          console.error(e)
          setError(e)
        }
      }}
    >
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
    </SubmitDialog>
  )
})
export default ImportBookmarksDialog
