import React from 'react'
import { Box, Button, Typography, FormControl } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { isElectron } from '../../util'
import { getBlob, storeBlobLocation } from '../../util/tracks'
import type {
  LocalPathLocation,
  FileLocation,
  BlobLocation,
} from '../../util/types'

function isLocalPathLocation(loc: FileLocation): loc is LocalPathLocation {
  return 'localPath' in loc
}

function isBlobLocation(loc: FileLocation): loc is BlobLocation {
  return 'blobId' in loc
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
      (isLocalPathLocation(location) && location.localPath))

  const needToReload =
    location && isBlobLocation(location) && !getBlob(location.blobId)

  return (
    <Box display="flex" flexDirection="row" alignItems="center">
      <Box>
        <FormControl fullWidth>
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
          <Typography color="error">(need to reload)</Typography>
        ) : null}
      </Box>
    </Box>
  )
}

export default LocalFileChooser
