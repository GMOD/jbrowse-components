import React from 'react'
import { Box, Button, Typography, FormControl, Theme } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { isElectron } from '../../util'
import { LocalPathLocation, FileLocation, BlobLocation } from '../../util/types'
import { getBlob, storeBlobLocation } from '../../util/tracks'

function isLocalPathLocation(
  location: FileLocation,
): location is LocalPathLocation {
  return 'localPath' in location
}

function isBlobLocation(location: FileLocation): location is BlobLocation {
  return 'blobId' in location
}

const useStyles = makeStyles()((theme: Theme) => ({
  filename: {
    marginLeft: theme.spacing(1),
  },
}))

function LocalFileChooser(props: {
  location?: FileLocation
  setLocation: Function
}) {
  const { classes } = useStyles()
  const { location, setLocation } = props

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
                const file = target && target.files && target.files[0]
                if (file) {
                  if (isElectron) {
                    setLocation({
                      localPath: (file as File & { path: string }).path,
                      locationType: 'LocalPathLocation',
                    })
                  } else {
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
