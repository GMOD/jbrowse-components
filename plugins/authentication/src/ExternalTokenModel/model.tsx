import { ConfigurationReference } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
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
import { RemoteFile } from 'generic-filehandle'

const stateModelFactory = (
  pluginManager: PluginManager,
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
      externalToken: '',
      currentTypeAuthorizing: '',
      needsToken: false,
    }))
    .views(self => ({
      get internetAccountType() {
        return 'ExternalTokenInternetAccount'
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
            tokenType: '',
            origin: self.origin,
          },
        }
      },
    }))
    .actions(self => ({
      async fetchFile(location: string) {
        if (!location || !self.externalToken) {
          return
        }
        // add a fetch call for gdc adding the token to the header, or place the header into
        // sessionstorage for fetch to use
      },
      setExternalToken(token: string) {
        self.externalToken = token
      },
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
        handleClose(token?: string) {
          if (token) {
            sessionStorage.setItem(`${self.internetAccountId}-token`, token)
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
            sessionStorage.getItem(`${self.internetAccountId}-token`)
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
            throw new Error('Auth Information Missing')
          }

          let foundToken
          try {
            foundToken = await this.checkToken()
          } catch (e) {}

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

          // switch (self.origin) {
          //   case 'GDC': {
          //     const query = (location as UriLocation).uri.split('/').pop() // should get id
          //     const response = await fetch(
          //       `${self.accountConfig.customEndpoint}/files/${query}?expand=index_files`,
          //       {
          //         method: 'GET',
          //       },
          //     )
        },
        async getPreAuthorizationInformation(location: UriLocation) {
          if (!preAuthInfo.authInfo) {
            preAuthInfo = self.generateAuthInfo
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
          // switch (self.origin) {
          //   case 'GDC': {
          //     const query = (location as UriLocation).uri.split('/').pop() // should get id
          //     const editedArgs = JSON.parse(JSON.stringify(args))
          //     searchOrReplaceInArgs(
          //       editedArgs,
          //       'uri',
          //       `${self.accountConfig.customEndpoint}/data/${query}`,
          //     )
          //     return editedArgs
          //   }
          // }
        },
        async handleError() {
          preAuthInfo = self.generateAuthInfo
          if (typeof sessionStorage !== 'undefined') {
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
      <Dialog open maxWidth="xl" data-testid="login-httpbasic">
        <DialogTitle>Enter Token for {internetAccountId}</DialogTitle>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            required
            label="Enter Token"
            variant="outlined"
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
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
