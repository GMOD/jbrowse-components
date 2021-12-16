import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { RemoteFileWithRangeCache } from '@jbrowse/core/util/io'
import { UriLocation } from '@jbrowse/core/util/types'
import { ExternalTokenInternetAccountConfigModel } from './configSchema'
import { Instance, types, getParent } from 'mobx-state-tree'
import React, { useState } from 'react'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogActions from '@material-ui/core/DialogActions'
import TextField from '@material-ui/core/TextField'

const inWebWorker = typeof sessionStorage === 'undefined'

const stateModelFactory = (
  configSchema: ExternalTokenInternetAccountConfigModel,
) => {
  return types
    .compose(
      'ExternalTokenInternetAccount',
      InternetAccount,
      types.model({
        id: 'ExternalToken',
        type: types.literal('ExternalTokenInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      needsToken: false,
    }))
    .views(self => ({
      get authHeader(): string {
        return getConf(self, 'authHeader')
      },
      get tokenType(): string {
        return getConf(self, 'tokenType')
      },
      get internetAccountType() {
        return 'ExternalTokenInternetAccount'
      },
      handlesLocation(location: UriLocation): boolean {
        const validDomains = self.accountConfig.domains || []
        return validDomains.some((domain: string) =>
          location?.uri.includes(domain),
        )
      },
      generateAuthInfo() {
        return {
          internetAccountType: this.internetAccountType,
          authInfo: {
            authHeader: this.authHeader,
            tokenType: this.tokenType,
            configuration: self.accountConfig,
          },
        }
      },
    }))
    .actions(self => ({
      setNeedsToken(bool: boolean) {
        self.needsToken = bool
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
            reject(new Error('user cancelled entry'))
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
                  ExternalTokenEntryForm,
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
          resolve()
          openLocationPromise = undefined
          return token
        },
        async getFetcher(
          url: RequestInfo,
          opts?: RequestInit,
        ): Promise<Response> {
          if (!preAuthInfo || !preAuthInfo.authInfo) {
            throw new Error(
              'Failed to obtain authorization information needed to fetch',
            )
          }

          let foundToken
          try {
            foundToken = await this.checkToken()
          } catch (e) {}

          let newOpts = opts
          if (foundToken) {
            const tokenInfoString = self.tokenType
              ? `${self.tokenType} ${preAuthInfo.authInfo.token}`
              : `${preAuthInfo.authInfo.token}`
            if (self.authHeader) {
              const newHeaders = {
                ...opts?.headers,
                [self.authHeader]: `${tokenInfoString}`,
              }
              newOpts = {
                ...opts,
                headers: newHeaders,
              }
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
          return new RemoteFileWithRangeCache(String(location.uri), {
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
            await this.handleError()
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
              await this.handleError()
            }
          }

          return preAuthInfo
        },
        async handleError() {
          if (!inWebWorker) {
            preAuthInfo = self.generateAuthInfo()
            sessionStorage.removeItem(`${self.internetAccountId}-token`)
          }

          throw new Error('Could not access resource with token')
        },
      }
    })
}

const ExternalTokenEntryForm = ({
  internetAccountId,
  handleClose,
}: {
  internetAccountId: string
  handleClose: (arg?: string) => void
}) => {
  const [token, setToken] = useState('')

  return (
    <>
      <Dialog open maxWidth="xl" data-testid="externalToken-form">
        <DialogTitle>Enter Token for {internetAccountId}</DialogTitle>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            required
            label="Enter Token"
            variant="outlined"
            inputProps={{ 'data-testid': 'entry-externalToken' }}
            onChange={event => {
              setToken(event.target.value)
            }}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={!token}
            onClick={() => {
              if (token) {
                handleClose(token)
              }
            }}
          >
            Add
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
export type ExternalTokenStateModel = ReturnType<typeof stateModelFactory>
export type ExternalTokenModel = Instance<ExternalTokenStateModel>
