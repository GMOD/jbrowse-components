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

import type {
  BlobLocation,
  FileHandleLocation,
  FileLocation,
  LocalPathLocation,
} from '../../util/types/index.ts'

function isLocalPathLocation(loc: FileLocation): loc is LocalPathLocation {
  return 'localPath' in loc
}

function isBlobLocation(loc: FileLocation): loc is BlobLocation {
  return 'blobId' in loc
}

function isFileHandleLocation(loc: FileLocation): loc is FileHandleLocation {
  return 'handleId' in loc
}

const useStyles = makeStyles()(theme => ({
  filename: {
    marginLeft: theme.spacing(1),
  },
}))

function LocalFileChooser({
  location,
  setLocation,
}: {
  location?: FileLocation
  setLocation: (arg: FileLocation) => void
}) {
  const { classes } = useStyles()
  const filename =
    location &&
    ((isBlobLocation(location) && location.name) ||
      (isLocalPathLocation(location) && location.localPath) ||
      (isFileHandleLocation(location) && location.name))

  const needToReload =
    (location && isBlobLocation(location) && !getBlob(location.blobId)) ||
    (location &&
      isFileHandleLocation(location) &&
      !getFileFromCache(location.handleId))

  const supportsFileSystemAccess = isFileSystemAccessSupported() && !isElectron
  console.log(
    '[LocalFileChooser] supportsFileSystemAccess:',
    supportsFileSystemAccess,
    'isElectron:',
    isElectron,
  )

  const handleFileSystemAccessPicker = async () => {
    console.log('[LocalFileChooser] handleFileSystemAccessPicker called')
    try {
      const [handle] = await window.showOpenFilePicker()
      console.log('[LocalFileChooser] got file handle:', handle.name)
      const loc = await storeFileHandleLocation(handle)
      console.log('[LocalFileChooser] stored location:', loc)
      setLocation(loc)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('[LocalFileChooser] File picker error:', e)
      }
    }
  }

  const handleReopenFileHandle = async () => {
    console.log('[LocalFileChooser] handleReopenFileHandle called')
    if (location && isFileHandleLocation(location)) {
      console.log(
        '[LocalFileChooser] attempting to reopen handleId:',
        location.handleId,
      )
      try {
        await ensureFileHandleReady(location.handleId, true)
        console.log('[LocalFileChooser] reopen successful, updating location')
        setLocation({ ...location })
      } catch (e) {
        console.error('[LocalFileChooser] Failed to reopen file:', e)
        handleFileSystemAccessPicker()
      }
    }
  }

  return (
    <Box display="flex" flexDirection="row" alignItems="center">
      <Box>
        <FormControl fullWidth>
          {supportsFileSystemAccess ? (
            <Button variant="outlined" onClick={handleFileSystemAccessPicker}>
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
                    if (isElectron) {
                      const { webUtils } = window.require('electron')
                      setLocation({
                        localPath: webUtils.getPathForFile(file),
                        locationType: 'LocalPathLocation',
                      })
                    } else {
                      // @ts-expect-error
                      setLocation(storeBlobLocation({ blob: file }))
                    }
                  }
                }}
              />
            </Button>
          )}
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
        {needToReload ? (
          <Box display="flex" alignItems="center" gap={1}>
            <Typography color="error">(need to reload)</Typography>
            {isFileHandleLocation(location) ? (
              <Button
                size="small"
                variant="text"
                color="primary"
                onClick={handleReopenFileHandle}
              >
                Reopen
              </Button>
            ) : null}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

export default LocalFileChooser
