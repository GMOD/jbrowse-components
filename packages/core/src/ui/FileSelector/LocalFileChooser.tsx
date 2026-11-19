import { useState } from 'react'

import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { invokeElectronMain } from '../../util/electron.ts'
import { isFileSystemAccessSupported } from '../../util/fileHandleStore.ts'
import {
  isElectron,
  localStorageGetItem,
  localStorageSetItem,
} from '../../util/index.ts'
import {
  ensureFileHandleReady,
  getBlob,
  getFileFromCache,
  storeBlobLocation,
  storeFileHandleLocation,
} from '../../util/tracks.ts'
import {
  isBlobLocation,
  isFileHandleLocation,
  isLocalPathLocation,
} from '../../util/types/index.ts'
import ControlRow from '../ControlRow.tsx'
import ErrorBanner from '../ErrorBanner.tsx'
import { dirFromPath } from './util.ts'

import type { FileLocation } from '../../util/types/index.ts'

declare global {
  interface Window {
    showOpenFilePicker(): Promise<FileSystemFileHandle[]>
  }
}

const supportsFileSystemAccess = isFileSystemAccessSupported() && !isElectron

const LAST_LOCAL_FILE_DIR_KEY = 'jbrowse-last-local-file-dir'

function getLastLocalFileDir() {
  return localStorageGetItem(LAST_LOCAL_FILE_DIR_KEY)
}

function setLastLocalFileDir(filePath: string) {
  const dir = dirFromPath(filePath)
  if (dir) {
    localStorageSetItem(LAST_LOCAL_FILE_DIR_KEY, dir)
  }
}

function getFilename(location?: FileLocation) {
  if (isBlobLocation(location) || isFileHandleLocation(location)) {
    return location.name
  }
  if (isLocalPathLocation(location)) {
    return location.localPath
  }
  return undefined
}

function needsReload(location?: FileLocation) {
  if (isBlobLocation(location)) {
    return !getBlob(location.blobId)
  }
  if (isFileHandleLocation(location)) {
    return !getFileFromCache(location.handleId)
  }
  return false
}

// resolves the chosen file's location, or undefined if the user cancelled the
// native picker (which surfaces as a DOMException AbortError)
async function pickFileHandleLocation() {
  try {
    const [handle] = await window.showOpenFilePicker()
    // showOpenFilePicker resolves with ≥1 handle on success. await before
    // returning so a rejection unwinds through this try/catch (letting the
    // AbortError check below see it) rather than escaping to the caller
    return await storeFileHandleLocation(handle!)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return undefined
    }
    throw e
  }
}

type LocationPicker = () => Promise<FileLocation | undefined>

async function pickElectronLocation() {
  const filePath = await invokeElectronMain(
    'promptOpenLocalFile',
    getLastLocalFileDir(),
  )
  if (filePath) {
    setLastLocalFileDir(filePath)
  }
  return filePath
    ? ({
        localPath: filePath,
        locationType: 'LocalPathLocation',
      } satisfies FileLocation)
    : undefined
}

const FilePickerButton = observer(function FilePickerButton({
  choose,
  setLocation,
}: {
  choose: (pick: LocationPicker) => void
  setLocation: (loc: FileLocation) => void
}) {
  return supportsFileSystemAccess || isElectron ? (
    <Button
      variant="outlined"
      onClick={() => {
        choose(
          supportsFileSystemAccess
            ? pickFileHandleLocation
            : pickElectronLocation,
        )
      }}
    >
      Choose File
    </Button>
  ) : (
    <Button variant="outlined" component="label">
      Choose File
      <input
        type="file"
        hidden
        onChange={({ target }) => {
          const file = target.files?.[0]
          if (file) {
            const loc = storeBlobLocation({ blob: file })
            if ('blobId' in loc) {
              setLocation(loc)
            }
          }
        }}
      />
    </Button>
  )
})

const ReloadPrompt = observer(function ReloadPrompt({
  location,
  choose,
}: {
  location: FileLocation
  choose: (pick: LocationPicker) => void
}) {
  return (
    <>
      <Typography color="error">(need to reload)</Typography>
      {isFileHandleLocation(location) && (
        <Button
          size="small"
          variant="text"
          color="primary"
          onClick={() => {
            choose(async () => {
              try {
                await ensureFileHandleReady(location.handleId, true)
                return { ...location }
              } catch {
                return pickFileHandleLocation()
              }
            })
          }}
        >
          Reopen
        </Button>
      )}
    </>
  )
})

const LocalFileChooser = observer(function LocalFileChooser({
  location,
  setLocation,
}: {
  location?: FileLocation
  setLocation: (arg: FileLocation) => void
}) {
  const [error, setError] = useState<unknown>()
  const filename = getFilename(location)
  const choose = (pick: LocationPicker) => {
    setError(undefined)
    pick()
      .then(loc => {
        if (loc) {
          setLocation(loc)
        }
      })
      .catch((e: unknown) => {
        console.error(e)
        setError(e)
      })
  }

  return (
    <>
      <ControlRow>
        <FilePickerButton choose={choose} setLocation={setLocation} />
        <Typography
          component="span"
          color={filename ? undefined : 'textSecondary'}
        >
          {filename || 'No file chosen'}
        </Typography>
        {location && needsReload(location) && (
          <ReloadPrompt location={location} choose={choose} />
        )}
      </ControlRow>
      {error ? <ErrorBanner error={error} /> : null}
    </>
  )
})

export default LocalFileChooser
