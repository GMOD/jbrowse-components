import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

export const CredentialDestination = observer(function CredentialDestination({
  domains,
}: {
  domains: readonly string[]
}) {
  return (
    <Typography variant="body2" color="textSecondary">
      Sent to {domains.length ? domains.join(', ') : 'this site'}
    </Typography>
  )
})
