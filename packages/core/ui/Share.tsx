import React from 'react'
import Button from '@material-ui/core/Button'
import ShareIcon from '@material-ui/icons/Share'
import { observer, PropTypes } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { getSnapshot } from 'mobx-state-tree'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import copy from 'copy-to-clipboard'
import { ContentCopy as ContentCopyIcon } from './Icons'
import { toUrlSafeB64 } from '../util'

// all notes for session sharing go here
// shared sessionid is hash of session
// in url, there is a uuid sessionid, this is diff than the hash
// when user pastes a hashed sessionid url, it downloads the session into localstorage, then assigns a new sessionid

// AWS side
// API Gateway
// - APIgateway with two endpoints
// - should be 2 POSTS, one to write a saved session and one to look up a saved session
// DONE

// Lambda
// code in save-session and read-session
// DONE

// DynamoDB
// -table created, has sessionId which is a primary key, sha-256 hash of the session contents
// and session, a string provided by JBrowse

// JB2 side
// -create a share UI button
// -onClick(), it uses fetchPOSTS to the api endpoint with the session URL and the sessionId which is a hash of the url, which triggers the lambda to
// write to dynamoDB
// -when navigating to a URL and parsing the session, JB2 POSTS to the api endpoint with the session URL entered
// if it's found also in the database, load the current session into local storage
// should be done, small nodejs version bookmarker of this, if they wanted to run themselves outside of AWS they could
// local:${uuid}
// jbsession_${uuid}

const useStyles = makeStyles(theme => ({
  shareButton: {
    textAlign: 'center',
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Share = observer((props: { session: any }) => {
  const { session } = props
  const classes = useStyles()
  const url =
    'https://g5um1mrb0i.execute-api.us-east-1.amazonaws.com/api/v1/share'

  const [open, setOpen] = React.useState(false)
  const [shareUrl, setShareUrl] = React.useState('')

  const handleClickOpen = (urlLink: string) => {
    setShareUrl(`?session=share:${urlLink}`)
    console.log(shareUrl)
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
  }
  return (
    <div className={classes.shareButton}>
      <Button
        data-testid="share_button"
        onClick={async () => {
          const sess = `${toUrlSafeB64(JSON.stringify(getSnapshot(session)))}`

          const data = new FormData()
          data.append('session', sess)

          let response
          try {
            response = await fetch(url, {
              method: 'POST',
              mode: 'cors',
              headers: {
                'Access-Control-Allow-Origin': '*',
              },
              body: data,
            })
          } catch (error) {
            // ignore
          }

          if (response && response.ok) {
            const json = await response.json()
            handleClickOpen(json.sessionId)
            // then on success, open a message box with share link and can copy to clipboard
          } else {
            // on fail, say failed to generate sharelink
          }
        }}
        size="small"
        color="inherit"
        startIcon={<ShareIcon />}
      >
        Share
      </Button>
      <Dialog
        maxWidth="xl"
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">JB2 Shareable Link</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {shareUrl}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              copy(shareUrl)
              session.notify('Copied to clipboard', 'success')
            }}
            color="primary"
            startIcon={<ContentCopyIcon />}
          >
            Copy to Clipboard
          </Button>
          <Button onClick={handleClose} color="primary" autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
})

export default Share
