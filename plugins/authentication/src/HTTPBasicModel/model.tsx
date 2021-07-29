// will move later, just putting here tempimport React from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation, AuthLocation } from '@jbrowse/core/util/types'
import { HTTPBasicInternetAccountConfigModel } from './configSchema'
import { Instance, types } from 'mobx-state-tree'
import React, { useState } from 'react'
import Button from '@material-ui/core/Button'
import { makeStyles } from '@material-ui/core/styles'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogActions from '@material-ui/core/DialogActions'
import Divider from '@material-ui/core/Divider'
import TextField from '@material-ui/core/TextField'
import ErrorIcon from '@material-ui/icons/Error'

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

const useStyles = makeStyles(theme => ({
  errorIcon: {
    marginRight: theme.spacing(2),
  },
}))

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: HTTPBasicInternetAccountConfigModel,
) => {
  return types
    .compose(
      'HTTPBasicInternetAccount',
      InternetAccount,
      types.model({
        id: 'HTTPBasic',
        type: types.literal('HTTPBasicInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      currentTypeAuthorizing: '',
      base64username: '',
      base64password: '',
    }))
    .views(self => ({
      get tokenType() {
        return getConf(self, 'tokenType') || 'Basic'
      },
      handlesLocation(location: FileLocation): boolean {
        // this will probably look at something in the config which indicates that it is an OAuth pathway,
        // also look at location, if location is set to need authentication it would reutrn true
        const validDomains = self.accountConfig.validDomains || []
        return validDomains.some((domain: string) =>
          (location as AuthLocation)?.uri.includes(domain),
        )
      },
    }))
    .actions(self => ({
      setBase64Username(username: string) {
        self.base64username = btoa(username)
      },
      setBase64Password(password: string) {
        self.base64password = btoa(password)
      },
      setTokenInfo() {
        sessionStorage.setItem(
          `${self.internetAccountId}-token`,
          `${self.base64username}:${self.base64password}`,
        )
      },
      async openLocation(location: FileLocation) {
        // notes:
        // need a field to enter a username and password
        // this has to be a dialog box with input fields
        // and the input password field needs to have those security settings
        // and able to autofill with lastpass/google
        // will have to resolve the promise in the "Ok" of the dialog box
        // check out https://github.com/GMOD/jbrowse-plugin-apollo/blob/login/src/components/LoginForm.tsx
        // for a simple login form
        // then base64 encode the entry to the form
        // create the auth header such as "Authorization": "Basic base64user:base64pass"
        // and then call the resource

        this.setTokenInfo()
      },
      async handleRpcMethodCall(
        location: FileLocation,
        authenticationInfoMap: Record<string, string>,
        args: {},
      ) {
        const token = authenticationInfoMap[self.internetAccountId]
        if (!token) {
          await this.openLocation(location)
        } // just need to generate token, don't need to edit any args

        return args
      },
    }))
}

const HTTPBasicLoginForm = ({
  internetAccountId,
  setUser,
  setPass,
  handleClose,
}: {
  internetAccountId: string
  setUser: (arg: string) => void
  setPass: (arg: string) => void
  handleClose: () => void
}) => {
  const classes = useStyles()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')

  function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    if (error) {
      setError('')
    }
    setConfirmed(true)
    event.preventDefault()
  }

  function handleUsernameChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (error) {
      setError('')
    }
    setUsername(event.target.value)
  }

  function handlePasswordChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    if (error) {
      setError('')
    }
    setPassword(event.target.value)
  }

  return (
    <>
      <DialogTitle>Log In for {internetAccountId}</DialogTitle>
      <form onSubmit={handleConfirm}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            required
            label="Username"
            variant="outlined"
            onChange={handleUsernameChange}
            margin="dense"
          />
          <TextField
            required
            label="Password"
            type="password"
            autoComplete="current-password"
            variant="outlined"
            onChange={handlePasswordChange}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            onClick={() => {
              setUser(username)
              setPass(password)
              handleClose()
            }}
          >
            Submit
          </Button>
          <Button variant="contained" color="primary" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </form>
      {error ? (
        <div>
          <DialogContentText color="error">
            <ErrorIcon className={classes.errorIcon} />
            {error}
          </DialogContentText>
        </div>
      ) : null}
    </>
  )
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
