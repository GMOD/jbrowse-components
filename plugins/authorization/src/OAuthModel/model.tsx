// will move later, just putting here tempimport React from 'react'
import {
  ConfigurationReference,
  getConf,
  readConfObject,
} from '@jbrowse/core/configuration'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { OAuthInternetAccountConfigModel } from './configSchema'
import { MenuItem } from '@jbrowse/core/ui'
import deepEqual from 'fast-deep-equal'
import { autorun, when } from 'mobx'
import { addDisposer, getSnapshot, Instance, types } from 'mobx-state-tree'
import { getContainingTrack } from '@jbrowse/core/util'

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
const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: OAuthInternetAccountConfigModel,
) => {
  return (
    types
      .compose(
        'OAuthInternetType',
        InternetAccount,
        types.model({
          id: 'OAuth',
          type: types.literal('OAuthInternetType'),
        }),
      )
      .volatile(() => ({
        authorizationCode: '',
      }))
      // handleslocation will have to look at config and see what domain it's pointing at
      // i.e if google drive oauth, handlesLocation looks at self.config.endpoint and see if it is the associated endpoint
      // if above returns true then do the oauth flow as openLocation to get the correct headers
      .views(self => ({
        handlesLocation(location: Location): boolean {
          // this will probably look at something in the config which indicates that it is an OAuth pathway,
          // also look at location, if location is set to need authentication it would reutrn true
          return getConf(self, 'needsAuthentication')
        },

        get authEndpoint() {
          return getConf(self, 'authEndpoint')
        },

        get tokenEndpoint() {
          return getConf(self, 'tokenEndpoint')
        },

        get PKCEToken() {
          return getConf(self, 'PKCEToken')
        },
      }))
      .actions(self => ({
        useEndpointForAuthorization(
          clientID: string,
          redirectURI?: string,
          additionalData?: { [key: string]: string | number },
        ) {
          const data = {
            client_id: clientID,
            redirect_uri: redirectURI ? redirectURI : window.location.hostname,
            response_type: 'code',
            ...additionalData,
          }

          const params = Object.entries(data)
            .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
            .join('&')
          const authorizationUrl = `${self.authEndpoint}/${params}`
          return window.open(authorizationUrl, 'Authorization') // add options for popup location if needed
        },
        setAuthorizationCode(code: string) {
          self.authorizationCode = code
        },
        async exchangeAuthorizationForAccessToken(
          clientID: string,
          PKCECode: string,
          redirectURI?: string,
        ) {
          const code = '' // get code from somewhere stored in the session
          const data = {
            code: code,
            grant_type: 'authorization_code',
            client_id: clientID,
            code_verifier: PKCECode,
            redirect_uri: redirectURI ? redirectURI : window.location.hostname,
          }
          const params = Object.entries(data)
            .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
            .join('&')
          const response = await fetch(self.tokenEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-encoded',
            },
            body: params,
          })

          const token = await response.json()
          return token
        },
        async openLocation(location: Location) {
          const clientID = getConf(self, 'clientID')
          if (self.authEndpoint) {
            this.useEndpointForAuthorization(clientID)
            if (self.tokenEndpoint /* && codeExists */) {
              const token = await this.exchangeAuthorizationForAccessToken(
                clientID,
                self.PKCEToken,
              )
              // set token somewhere
            }
          }
        },
      }))
  )
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
