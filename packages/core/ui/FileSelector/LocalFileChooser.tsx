import React from 'react'
import { Button, Typography } from '@material-ui/core'
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

function LocalFileChooser(props: {
  location?: FileLocation
  setLocation: Function
}) {
  const { location, setLocation } = props

  const filename =
    location &&
    ((isBlobLocation(location) && location.name) ||
      (isLocalPathLocation(location) && location.localPath))

  const needToReload =
    location && isBlobLocation(location) && !getBlob(location.blobId)

  return (
    <div style={{ position: 'relative' }}>
      <Button variant="outlined" component="label">
        Choose File
        <input
          type="file"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            opacity: 0,
          }}
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
      {filename ? (
        <>
          <Typography
            style={{ marginLeft: '0.4rem' }}
            variant="body1"
            component="span"
          >
            {filename}
          </Typography>
          {needToReload ? (
            <Typography color="error">(need to reload)</Typography>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export default LocalFileChooser
