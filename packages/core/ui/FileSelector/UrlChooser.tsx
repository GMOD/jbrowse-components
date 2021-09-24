import React from 'react'
import { Grid, TextField, Typography } from '@material-ui/core'
import { observer } from 'mobx-react'
import { FileLocation, isUriLocation } from '../../util/types'
import { Info } from '@material-ui/icons'

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

function UrlChooser(props: {
  location?: FileLocation
  setLocation: Function
  currentInternetAccount: Account | undefined
}) {
  const { location, setLocation, currentInternetAccount } = props

  return (
    <>
      <TextField
        fullWidth
        inputProps={{ 'data-testid': 'urlInput' }}
        defaultValue={location && isUriLocation(location) ? location.uri : ''}
        label="Enter URL"
        onChange={event => {
          if (currentInternetAccount) {
            setLocation({
              uri: event.target.value,
              baseAuthUri: event.target.value,
              internetAccountId: currentInternetAccount.internetAccountId || '',
              locationType: 'UriLocation',
            })
          } else {
            setLocation({
              uri: event.target.value.trim(),
              locationType: 'UriLocation',
            })
          }
        }}
      />
      {currentInternetAccount && (
        <Grid item>
          <Info />
          <Typography
            color="textSecondary"
            variant="caption"
            style={{ paddingLeft: '4px' }}
          >
            Your data will be authenticated using {currentInternetAccount.name}
          </Typography>
        </Grid>
      )}
    </>
  )
}

export default observer(UrlChooser)
