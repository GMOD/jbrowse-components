import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation, UriLocation } from '@jbrowse/core/util/types'
import { getParent } from 'mobx-state-tree'
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
          (location as UriLocation)?.uri.includes(domain),
        )
      },
    }))
    .actions(self => {
      let resolve: Function = () => {}
      let reject: Function = () => {}
      let openLocationPromise: Promise<string> | undefined = undefined
      return {
        setTokenInfo(token: string) {
          sessionStorage.setItem(`${self.internetAccountId}-token`, token)
        },
        handleClose(token?: string) {
          const { session } = getParent(self, 2)
          if (token) {
            this.setTokenInfo(token)
            resolve(token)
          } else {
            reject(new Error('user cancelled'))
          }

          session.setDialogComponent(undefined, undefined)
          resolve = () => {}
          reject = () => {}
          openLocationPromise = undefined
        },

        async openLocation(location: FileLocation) {
          if (!openLocationPromise) {
            openLocationPromise = new Promise(async (r, x) => {
              const { session } = getParent(self, 2)
              session.setDialogComponent(HTTPBasicLoginForm, {
                internetAccountId: self.internetAccountId,
                handleClose: this.handleClose,
              })
              resolve = r
              reject = x
            })
          }

          return openLocationPromise
        },
        async handleRpcMethodCall(
          location: UriLocation,
          authenticationInfoMap: Record<string, string>,
          args: {},
        ) {
          let token = authenticationInfoMap[self.internetAccountId]

          if (!token) {
            token = await this.openLocation(location)
          }

          // test
          const response = await fetch(location.uri, {
            method: 'HEAD',
            headers: {
              Authorization: `${self.tokenType} ${token}`,
            },
          })

          if (!response.ok) {
            await this.handleError(authenticationInfoMap)
          }

          return args
        },
        async handleError(authenticationInfoMap: Record<string, string>) {
          const rootModel = getParent(self, 2)
          return authenticationInfoMap
        },
      }
    })
}

const HTTPBasicLoginForm = ({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (arg?: string) => void
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
                handleClose(btoa(`${username}:${password}`))
              }
            }}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              handleClose()
            }}
          >
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
