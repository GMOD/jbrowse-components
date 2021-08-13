import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { UriLocation } from '@jbrowse/core/util/types'
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
import { RemoteFile } from 'generic-filehandle'

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
      get internetAccountType() {
        return 'HTTPBasicInternetAccount'
      },
      handlesLocation(location: UriLocation): boolean {
        // this will probably look at something in the config which indicates that it is an OAuth pathway,
        // also look at location, if location is set to need authentication it would reutrn true
        const validDomains = self.accountConfig.validDomains || []
        return validDomains.some((domain: string) =>
          location?.uri.includes(domain),
        )
      },
      get generateAuthInfo() {
        return {
          internetAccountType: this.internetAccountType,
          authInfo: {
            authHeader: self.authHeader,
            tokenType: this.tokenType,
            origin: self.origin,
          },
        }
      },
    }))
    .actions(self => {
      let resolve: Function = () => {}
      let reject: Function = () => {}
      let openLocationPromise: Promise<string> | undefined = undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let preAuthInfo: any = {}
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
            reject()
          }

          session.setDialogComponent(undefined, undefined)
          resolve = () => {}
          reject = () => {}
          openLocationPromise = undefined
        },
        async checkToken() {
          let token =
            preAuthInfo?.authInfo?.token ||
            sessionStorage.getItem(`${self.internetAccountId}-token`)
          if (!token) {
            if (!openLocationPromise) {
              openLocationPromise = new Promise(async (r, x) => {
                const { session } = getParent(self, 2)

                // session.launchDialog((thisDialogIsDone: Function) => [
                //   HTTPBasicLoginForm,
                //   {
                //     internetAccountId: self.internetAccountId,
                //     handleClose: () => {
                //       this.handleClose()
                //       thisDialogIsDone()
                //     },
                //   },
                // ])
                session.setDialogComponent(HTTPBasicLoginForm, {
                  internetAccountId: self.internetAccountId,
                  handleClose: this.handleClose,
                })
                resolve = r
                reject = x
              })
            }
            token = await openLocationPromise
          }

          if (!preAuthInfo.authInfo.token) {
            preAuthInfo.authInfo.token = token
          }

          return token
        },

        async getFetcher(
          url: RequestInfo,
          opts?: RequestInit,
        ): Promise<Response> {
          if (!preAuthInfo || !preAuthInfo.authInfo) {
            throw new Error('Auth Information Missing')
          }

          let foundToken
          try {
            foundToken = await this.checkToken()
          } catch (e) {
            this.handleError()
          }

          let newOpts = opts
          if (foundToken) {
            const newHeaders = {
              ...opts?.headers,
              [self.authHeader]: `${self.tokenType} ${preAuthInfo.authInfo.token}`,
            }
            newOpts = {
              ...opts,
              headers: newHeaders,
            }
          }

          return fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            ...newOpts,
          })
        },
        openLocation(location: UriLocation) {
          preAuthInfo =
            location.internetAccountPreAuthorization || self.generateAuthInfo
          return new RemoteFile(String(location.uri), {
            fetch: this.getFetcher,
          })
        },
        async getPreAuthorizationInformation(location: UriLocation) {
          if (!preAuthInfo.authInfo) {
            preAuthInfo = self.generateAuthInfo
          }
          let accessToken
          try {
            accessToken = await this.checkToken()
          } catch (error) {
            this.handleError()
          }

          // test
          if (accessToken) {
            const response = await fetch(location.uri, {
              method: 'HEAD',
              headers: {
                Authorization: `${self.tokenType} ${accessToken}`,
              },
            })

            if (!response.ok) {
              try {
                this.handleError()
              } catch (e) {}
            }

            return preAuthInfo
          }
        },
        handleError() {
          preAuthInfo = self.generateAuthInfo
          if (sessionStorage) {
            sessionStorage.removeItem(`${self.internetAccountId}-token`)
          }

          throw new Error('Could not access resource with token')
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
