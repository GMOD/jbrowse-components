import { Box, Button, FormControl, Typography } from '@mui/material'

import { isFileSystemAccessSupported } from '../../util/fileHandleStore.ts'
import { isElectron } from '../../util/index.ts'
import {
  ensureFileHandleReady,
  getBlob,
  getFileFromCache,
  storeBlobLocation,
  storeFileHandleLocation,
} from '../../util/tracks.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import {
  isBlobLocation,
  isFileHandleLocation,
  isLocalPathLocation,
} from '../../util/types/index.ts'

import type { FileLocation } from '../../util/types/index.ts'

const useStyles = makeStyles()(theme => ({
  filename: {
    marginLeft: theme.spacing(1),
  },
}))

const supportsFileSystemAccess = isFileSystemAccessSupported() && !isElectron

function getFilename(location?: FileLocation) {
  if (!location) {
    return undefined
  }
  if (isBlobLocation(location)) {
    return location.name
  }
  if (isLocalPathLocation(location)) {
    return location.localPath
  }
  if (isFileHandleLocation(location)) {
    return location.name
  }
  return undefined
}

function needsReload(location?: FileLocation) {
  if (!location) {
    return false
  }
  if (isBlobLocation(location)) {
    return !getBlob(location.blobId)
  }
  if (isFileHandleLocation(location)) {
    return !getFileFromCache(location.handleId)
  }
  return false
}

async function openFileSystemAccessPicker() {
  // @ts-expect-error
  const [handle] = await window.showOpenFilePicker()
  return storeFileHandleLocation(handle)
}

function FilePickerButton({
  setLocation,
}: {
  setLocation: (loc: FileLocation) => void
}) {
  if (supportsFileSystemAccess) {
    return (
      <Button
        variant="outlined"
        onClick={async () => {
          try {
            setLocation(await openFileSystemAccessPicker())
          } catch (e) {
            // User cancelled the picker
            if ((e as Error).name !== 'AbortError') {
              throw e
            }
          }
        }}
      >
        Choose File
      </Button>
    )
  }

  return (
    <Button variant="outlined" component="label">
      Choose File
      <input
        type="file"
        hidden
        onChange={({ target }) => {
          const file = target.files?.[0]
          if (file) {
            if (isElectron) {
              const { webUtils } = window.require('electron')
              setLocation({
                localPath: webUtils.getPathForFile(file),
                locationType: 'LocalPathLocation',
              })
            } else {
              const loc = storeBlobLocation({ blob: file })
              if ('blobId' in loc) {
                setLocation(loc)
              }
            }
          }
        }}
      />
    </Button>
  )
}

function ReloadPrompt({
  location,
  setLocation,
}: {
  location: FileLocation
  setLocation: (loc: FileLocation) => void
}) {
  const handleReopen = async () => {
    if (isFileHandleLocation(location)) {
      try {
        await ensureFileHandleReady(location.handleId, true)
        setLocation({ ...location })
      } catch {
        try {
          setLocation(await openFileSystemAccessPicker())
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            throw e
          }
        }
      }
    }
  }

  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Typography color="error">(need to reload)</Typography>
      {isFileHandleLocation(location) && (
        <Button
          size="small"
          variant="text"
          color="primary"
          onClick={handleReopen}
        >
          Reopen
        </Button>
      )}
    </Box>
  )
}

function LocalFileChooser({
  location,
  setLocation,
}: {
  location?: FileLocation
  setLocation: (arg: FileLocation) => void
}) {
  const { classes } = useStyles()
  const filename = getFilename(location)

  return (
    <Box display="flex" flexDirection="row" alignItems="center">
      <Box>
        <FormControl fullWidth>
          <FilePickerButton setLocation={setLocation} />
        </FormControl>
      </Box>
      <Box>
        <Typography
          component="span"
          className={classes.filename}
          color={filename ? 'initial' : 'textSecondary'}
        >
          {filename || 'No file chosen'}
        </Typography>
        {location && needsReload(location) && (
          <ReloadPrompt location={location} setLocation={setLocation} />
        )}
      </Box>
    </Box>
  )
}

export default LocalFileChooser
