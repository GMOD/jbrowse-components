import { Typography } from '@mui/material'

export function CredentialDestination({ domains }: { domains: string[] }) {
  return (
    <Typography variant="body2" color="textSecondary">
      Sent to {domains.length ? domains.join(', ') : 'this site'}
    </Typography>
  )
}
