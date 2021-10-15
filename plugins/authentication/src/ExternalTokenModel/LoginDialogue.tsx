import React, { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'
import CloseIcon from '@material-ui/icons/Close'

const useStyles = makeStyles(theme => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[500],
  },
  root: {
    margin: theme.spacing(1),
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
  },
  imgContainer: {
    display: 'flex',
    justifyContent: 'center',
  },
  img: {
    width: 100,
    maxWidth: '100%',
    maxHeight: '100%',
    verticalAlign: 'middle',
  },
  helperTextContainer: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  submitTokenContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  buttonContainer: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  alertContainer: {
    paddingBottom: theme.spacing(2),
  },
}))

export default function LoginDialogue({
  setTokenStored,
  setAuthErrorMessage,
  handleClose,
}: {
  setTokenStored?: any
  setAuthErrorMessage?: any
  handleClose: (arg?: string) => void
}) {
  const [token, setToken] = useState('')
  const classes = useStyles()

  // const handleLogin = () => {
  //   setAuthErrorMessage(false)
  //   setTokenStored(true)
  //   handleClose()
  // }

  return (
    <Dialog open onClose={() => handleClose()} maxWidth="sm">
      <DialogTitle>
        Login to access controlled GDC data
        <IconButton
          className={classes.closeButton}
          onClick={() => handleClose()}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <div className={classes.root}>
          <div className={classes.paper}>
            <div className={classes.imgContainer}>
              <img
                className={classes.img}
                src="https://me-pedia.org/images/2/2b/NIH_logo.png"
              ></img>
            </div>
            <div className={classes.helperTextContainer}>
              <Typography variant="h6" component="h1" align="center">
                Login to access controlled data
              </Typography>
              <Typography variant="body1" align="center">
                An authentication token is required to access controlled data.
              </Typography>
              <Typography variant="body2" align="center">
                You will need to provide your authentication token every time
                you start a new session, as the token is deleted when the
                session expires.
              </Typography>
            </div>
            <div className={classes.submitTokenContainer}>
              <TextField
                color="primary"
                variant="outlined"
                label="Enter token"
                onChange={event => {
                  setToken(event.target.value)
                }}
              />
              <div className={classes.buttonContainer}>
                <Button
                  color="primary"
                  variant="contained"
                  size="large"
                  onClick={() => {
                    handleClose(token)
                  }}
                >
                  Login
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
