// will move later, just putting here tempimport React from 'react'
import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { getRoot } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { OAuthInternetAccountConfigModel } from './configSchema'
import crypto from 'crypto'
import { addDisposer, getSnapshot, Instance, types } from 'mobx-state-tree'

// Notes go here:
// instead of laying out the abstractions first,
// just create a menu item that is 'Open Dropbox'
// and have the onclick handle all the the oauth logic
// to get the access_token to see what abstractions we would need

// can authorize and get access token
// adding track to session is technically adding wrong link, it is adding a share link
// while to access the track contents, it must fetch with the Bearer access token and get a temporary link
// which can be used to load

// if chooser is first,
// put a menu item to open dropbox or open google drive
// similar to igv where the menu item action is that it opens the chooser
// and the user selects a file, where that file will be put into the track selector
// or maybe in the 'Add track' flow, add an option for add from dropbox/google drive
// or maybe its just part of the file selector flow (such as import form or sv inspector import form)

// make a new core plugin called authentication
// put OAuthModel file there, plugin would have implementation of Oauth, HTTPBasic, etc
// need to edit the current openLocation, move it to action on rootModel
// new openLocation: check if any of the handleLocations return true, then call that openLocation

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: OAuthInternetAccountConfigModel,
) => {
  return (
    types
      .compose(
        'OAuthInternetAccount',
        InternetAccount,
        types.model({
          id: 'OAuth',
          type: types.literal('OAuthInternetAccount'),
        }),
      )
      .volatile(() => ({
        authorizationCode: '',
        accessToken: '',
        currentTypeAuthorizing: '',
        codeVerifierPKCE: '',
      }))
      // handleslocation will have to look at config and see what domain it's pointing at
      // i.e if google drive oauth, handlesLocation looks at self.config.endpoint and see if it is the associated endpoint
      // if above returns true then do the oauth flow as openLocation to get the correct headers
      .views(self => ({
        handlesLocation(location: Location): boolean {
          // this will probably look at something in the config which indicates that it is an OAuth pathway,
          // also look at location, if location is set to need authentication it would reutrn true
          return readConfObject(getRoot(self), 'needsAuthentication')
        },
      }))
      .actions(self => ({
        useEndpointForAuthorization(account: Account) {
          const data = {
            client_id: account.clientId,
            redirect_uri: 'http://localhost:3000',
            response_type: account.responseType || 'code',
          }

          this.setCurrentTypeAuthorizing(account.internetAccountId)

          if (account.scopes) {
            // @ts-ignore
            data.scope = account.scopes
          }

          if (account.needsPKCE) {
            const base64Encode = (buf: Buffer) => {
              return buf
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '')
            }
            const codeVerifier = base64Encode(crypto.randomBytes(32))
            const sha256 = (str: string) => {
              return crypto.createHash('sha256').update(str).digest()
            }
            const codeChallenge = base64Encode(sha256(codeVerifier))
            // @ts-ignore
            data.code_challenge = codeChallenge
            // @ts-ignore
            data.code_challenge_method = 'S256'

            this.setCodeVerifierPKCE(codeVerifier)
          }

          const params = Object.entries(data)
            .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
            .join('&')

          const url = `${account.authEndpoint}?${params}`
          const options = `width=500,height=600,left=0,top=0`
          return window.open(url, 'Authorization', options)
        },
        setAuthorizationCode(code: string) {
          self.authorizationCode = code
        },
        setCurrentTypeAuthorizing(type: string) {
          self.currentTypeAuthorizing = type
        },
        setCodeVerifierPKCE(codeVerifier: string) {
          self.codeVerifierPKCE = codeVerifier
        },
        setAccessToken(token: string) {
          self.accessToken = token
          console.log(token)
        },
        async exchangeAuthorizationForAccessToken(token: string) {
          const internetAccounts: Account[] = readConfObject(
            getRoot(self).jbrowse,
            'internetAccounts',
          )
          const account = internetAccounts.find(
            account =>
              account.internetAccountId === self.currentTypeAuthorizing,
          )
          if (account) {
            const data = {
              code: token,
              grant_type: 'authorization_code',
              client_id: account.clientId,
              code_verifier: self.codeVerifierPKCE,
              redirect_uri: 'http://localhost:3000',
            }

            const params = Object.entries(data)
              .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
              .join('&')

            const response = await fetch(`${account.tokenEndpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: params,
            })

            const accessToken = await response.json()
            this.setAccessToken(accessToken.access_token)
            sessionStorage.setItem(
              `${account.internetAccountId}-token`,
              accessToken.access_token,
            )
            this.setCurrentTypeAuthorizing('')
          }
        },
        async openLocation(location: Location) {
          // const clientId = getConf(self, 'clientId')
          // if (self.authEndpoint) {
          //   this.useEndpointForAuthorization(clientId)
          //   if (self.tokenEndpoint /* && codeExists */) {
          //     const token = await this.exchangeAuthorizationForAccessToken(
          //       clientId,
          //       self.PKCEToken,
          //     )
          //     // set token somewhere
          //     self.setLoggedIn(true)
          //   }
          // }
          return 'hello'
        },
      }))
  )
}
// will probably add an aftercreate that checks sessionStorage for existence of a valid token that is still working,
// if so use that as the token and mark yourself logged in

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
