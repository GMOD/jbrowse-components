import { ConfigurationReference } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation, UriLocation } from '@jbrowse/core/util/types'
import { ExternalTokenInternetAccountConfigModel } from './configSchema'
import { Instance, types, getParent } from 'mobx-state-tree'
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
      handlesLocation(location: FileLocation): boolean {
        // this will probably look at something in the config which indicates that it is an OAuth pathway,
        // also look at location, if location is set to need authentication it would reutrn true
        const validDomains = self.accountConfig.validDomains || []
        return validDomains.some((domain: string) =>
          (location as UriLocation)?.uri.includes(domain),
        )
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
      getOrSetExternalToken() {
        if (!self.needsToken) {
          return ''
        }
        const tokenKey = Object.keys(sessionStorage).find(key => {
          return key === `${self.internetAccountId}-token`
        })
        let token = sessionStorage.getItem(tokenKey as string)

        // prompt user for token if there isnt one existing
        // if a user doesnt enter a token allow them to continue without token

        // for GDC there is a way to tell if it needs a token or not
        // first call is an api endpoint, you get metadata for the file and has a property
        // called access, if access is set to controller it needs a token, else it doesn't
        if (!token) {
          const newToken = window.prompt(`Enter token for ${self.name} to use`)
          if (!newToken) {
            return
          }
          token = newToken
          sessionStorage.setItem(`${self.internetAccountId}-token`, token)
        }

        return token
      },
    }))
    .actions(self => {
      let resolve: Function = () => {}
      let reject: Function = () => {}
      let openLocationPromise: Promise<string> | undefined = undefined
      return {
        handleClose(token?: string) {
          const { session } = getParent(self, 2)
          if (token) {
            sessionStorage.setItem(`${self.internetAccountId}-token`, token)
            resolve(token)
          } else {
            reject(new Error('user cancelled entry'))
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
              session.setDialogComponent(ExternalTokenEntryForm, {
                internetAccountId: self.internetAccountId,
                handleClose: this.handleClose,
              })
              resolve = r
              reject = x
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

            //     if (!response.ok) {
            //       const errorText = await response.text()
            //       throw new Error(
            //         `Network response failure: ${response.status} (${errorText})`,
            //       )
            //     }

            //     const metadata = await response.json()
            //     if (metadata) {
            //       metadata.data.access === 'controlled'
            //         ? self.setNeedsToken(true)
            //         : self.setNeedsToken(false)
            //     }

            //     self.getOrSetExternalToken()
            //   }
          }
          return openLocationPromise
        },
        async handleRpcMethodCall(
          location: UriLocation,
          authenticationInfoMap: Record<string, string>,
          args: {},
        ) {
          const token = authenticationInfoMap[self.internetAccountId]
          if (!token) {
            await this.openLocation(location)
          }

          try {
            const response = await fetch(location.uri, {
              method: 'HEAD',
              headers: {
                Authorization: `${self.tokenType} ${token}`,
              },
            })

            if (!response.ok) {
              const errorText = await response.text()
              await this.handleError(
                authenticationInfoMap,
                `Network response failure: ${response.status} (${errorText})`,
              )
            }
          } catch (e) {
            await this.handleError(authenticationInfoMap, e)
          }

          return args
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
        async handleError(
          authenticationInfoMap: Record<string, string>,
          errorText: string,
        ) {
          const rootModel = getParent(self, 2)
          return new Error(errorText)
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
