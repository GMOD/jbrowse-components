// will move later, just putting here tempimport React from 'react'
import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation, AuthLocation } from '@jbrowse/core/util/types'

import { getRoot } from 'mobx-state-tree'
import { HTTPBasicInternetAccountConfigModel } from './configSchema'
import { Instance, types } from 'mobx-state-tree'
import React, { useState } from 'react'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogActions from '@material-ui/core/DialogActions'
import TextField from '@material-ui/core/TextField'

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

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
    }))
    .actions(self => {
      let resolve: Function = () => {}
      let reject: Function = () => {}
      let openLocationPromise: Promise<string> | undefined = undefined
      return {
        setTokenInfo() {
          if (self.base64username && self.base64password) {
            sessionStorage.setItem(
              `${self.internetAccountId}-token`,
              `${self.base64username}:${self.base64password}`,
            )
            resolve()
          } else {
            reject()
          }
          resolve = () => {}
          reject = () => {}
        },
        handleClose() {
          const { session } = getRoot(self)
          this.setTokenInfo()
          session.setDialogComponent(undefined, undefined)
        },

        async openLocation(location: FileLocation) {
          if (!openLocationPromise) {
            openLocationPromise = new Promise(async (r, x) => {
              const { session } = getRoot(self)
              session.setDialogComponent(HTTPBasicLoginForm, {
                internetAccountId: self.internetAccountId,
                setUser: self.setBase64Username,
                setPass: self.setBase64Password,
                handleClose: this.handleClose,
              })
              resolve = r
              reject = x
            })
          }

          return openLocationPromise
        },
        async handleRpcMethodCall(
          location: FileLocation,
          authenticationInfoMap: Record<string, string>,
          args: {},
        ) {
          const token = authenticationInfoMap[self.internetAccountId]
          if (!token) {
            await this.openLocation(location)
          }

          return args
        },
      }
    })
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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <>
      <Dialog open maxWidth="xl" data-testid="login-httpbasic">
        <DialogTitle>Log In for {internetAccountId}</DialogTitle>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            required
            label="Username"
            variant="outlined"
            onChange={event => {
              setUsername(event.target.value)
            }}
            margin="dense"
          />
          <TextField
            required
            label="Password"
            type="password"
            autoComplete="current-password"
            variant="outlined"
            onChange={event => {
              setPassword(event.target.value)
            }}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={!username || !password}
            onClick={() => {
              if (username && password) {
                setUser(username)
                setPass(password)
                handleClose()
              }
            }}
          >
            Submit
          </Button>
          <Button variant="contained" color="primary" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
