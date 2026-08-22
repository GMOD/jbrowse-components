import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'

export function OAuthLoginPrompt({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (proceed: boolean) => void
}) {
  return (
    <Dialog
      open
      maxWidth="xs"
      data-testid="oauth-login-prompt"
      title={`Log in to ${internetAccountId}`}
      onClose={() => {
        handleClose(false)
      }}
    >
      <DialogContent>
        <Typography>
          This session has a track that needs you to log in to{' '}
          {internetAccountId}. Browsers only allow the login window to open from
          a click, so it could not be opened on your behalf.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => {
            handleClose(false)
          }}
        >
          Cancel
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            handleClose(true)
          }}
        >
          Log in
        </Button>
      </DialogActions>
    </Dialog>
  )
}
