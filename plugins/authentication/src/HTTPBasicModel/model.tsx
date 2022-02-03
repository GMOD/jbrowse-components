import React, { useState } from 'react'
import { RemoteFile } from 'generic-filehandle'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { UriLocation } from '@jbrowse/core/util/types'
import { getParent } from 'mobx-state-tree'
import { HTTPBasicInternetAccountConfigModel } from './configSchema'
import { Instance, types } from 'mobx-state-tree'
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  TextField,
} from '@material-ui/core'

const inWebWorker = typeof sessionStorage === 'undefined'

const stateModelFactory = (
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
    .views(self => ({
      generateAuthInfo() {
        return {
          internetAccountType: self.type,
          authInfo: {
            authHeader: self.authHeader,
            tokenType: self.tokenType,
            configuration: self.accountConfig,
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
          if (token) {
            if (!inWebWorker) {
              this.setTokenInfo(token)
            }
            resolve(token)
          } else {
            reject()
          }

          resolve = () => {}
          reject = () => {}
          openLocationPromise = undefined
        },
        async checkToken() {
          let token =
            preAuthInfo?.authInfo?.token ||
            (!inWebWorker
              ? sessionStorage.getItem(`${self.internetAccountId}-token`)
              : null)
          if (!token) {
            if (!openLocationPromise) {
              openLocationPromise = new Promise(async (r, x) => {
                const { session } = getParent(self, 2)

                session.queueDialog((doneCallback: Function) => [
                  HTTPBasicLoginForm,
                  {
                    internetAccountId: self.internetAccountId,
                    handleClose: (token: string) => {
                      this.handleClose(token)
                      doneCallback()
                    },
                  },
                ])
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
            const tokenInfoString = self.tokenType
              ? `${self.tokenType} ${preAuthInfo.authInfo.token}`
              : `${preAuthInfo.authInfo.token}`
            const newHeaders = {
              ...opts?.headers,
              [self.authHeader]: `${tokenInfoString}`,
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
            location.internetAccountPreAuthorization || self.generateAuthInfo()
          return new RemoteFile(String(location.uri), {
            fetch: this.getFetcher,
          })
        },
        async getPreAuthorizationInformation(location: UriLocation) {
          if (!preAuthInfo.authInfo) {
            preAuthInfo = self.generateAuthInfo()
          }

          if (inWebWorker && !location.internetAccountPreAuthorization) {
            throw new Error(
              'Failed to obtain authorization information needed to fetch',
            )
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
          if (!inWebWorker) {
            preAuthInfo = self.generateAuthInfo()
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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (username && password) {
      handleClose(btoa(`${username}:${password}`))
    } else {
      handleClose()
    }
    event.preventDefault()
  }

  return (
    <>
      <Dialog open maxWidth="xl" data-testid="login-httpbasic">
        <DialogTitle>Log In for {internetAccountId}</DialogTitle>
        <form onSubmit={onSubmit}>
          <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
            <TextField
              required
              label="Username"
              variant="outlined"
              inputProps={{ 'data-testid': 'login-httpbasic-username' }}
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
              inputProps={{ 'data-testid': 'login-httpbasic-password' }}
              onChange={event => {
                setPassword(event.target.value)
              }}
              margin="dense"
            />
          </DialogContent>
          <DialogActions>
            <Button variant="contained" color="primary" type="submit">
              Submit
            </Button>
            <Button
              variant="contained"
              color="default"
              type="submit"
              onClick={() => {
                handleClose()
              }}
            >
              Cancel
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}

export default stateModelFactory
export type HTTPBasicStateModel = ReturnType<typeof stateModelFactory>
export type HTTPBasicModel = Instance<HTTPBasicStateModel>
