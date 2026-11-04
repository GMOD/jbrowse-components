import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { isElectron } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import { configSchema as OAuthConfigSchema } from '../OAuthModel/index.ts'
import baseModel from '../OAuthModel/model.tsx'
import DropboxIcon from './DropboxIcon.tsx'
import { chooseDropboxFile } from './chooser.ts'
import { getDescriptiveErrorMessage } from './util.ts'

import type {
  DropboxOAuthInternetAccountConfig,
  DropboxOAuthInternetAccountConfigModel,
} from './configSchema.ts'
import type { UriLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel DropboxOAuthInternetAccount
 * Fetches a file from a Dropbox share link through the Dropbox API, with an
 * OAuth 2.0 token from the Dropbox login.
 */
const stateModelFactory = (
  configSchema: DropboxOAuthInternetAccountConfigModel,
) => {
  return baseModel(OAuthConfigSchema)
    .named('DropboxOAuthInternetAccount')
    .props({
      /**
       * #property
       */
      type: types.literal('DropboxOAuthInternetAccount'),
      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),
    })
    .views(self => ({
      /**
       * #getter
       */
      get dropboxConf(): DropboxOAuthInternetAccountConfig {
        return self.configuration
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Offered on the web only, once `chooser` is on: the Chooser runs in a
       * popup, which the desktop navigation guard would send to the system
       * browser
       */
      get browseLabel() {
        return !isElectron && readConfObject(self.dropboxConf, 'chooser')
          ? 'Browse Dropbox'
          : undefined
      },
      /**
       * #getter
       * The FileSelector icon for Dropbox
       */
      get toggleContents() {
        return <DropboxIcon />
      },
      /**
       * #getter
       */
      get selectorLabel() {
        return 'Enter Dropbox share link'
      },
      /**
       * #getter
       * Dropbox issues a refresh token only when the authorization request
       * asks for offline access, and spells that `token_access_type` where
       * other providers use `access_type` — so it belongs here rather than on
       * every OAuth account.
       */
      get authFlowParams() {
        return { token_access_type: 'offline' }
      },
    }))
    .actions(self => ({
      /**
       * #action
       * The Chooser needs only the app key, which is the OAuth `clientId`. Its
       * preview link is a shared link, which the fetcher below reads with the
       * user's token
       */
      async chooseLocation() {
        const file = await chooseDropboxFile(self.clientId)
        const location: UriLocation | undefined = file
          ? { locationType: 'UriLocation', uri: file.link }
          : undefined
        return location
      },
      /**
       * #method
       */
      getFetcher(location?: UriLocation) {
        return async (input: RequestInfo, init?: RequestInit) => {
          const response = await self.fetchWithToken(location, authToken => {
            // built per attempt: the Headers are appended to below, so a retry
            // reusing them would send two Dropbox-API-Arg values
            const newInit = self.addAuthHeaderToInit(
              { ...init, method: 'POST' },
              authToken,
            )
            newInit.headers.append(
              'Dropbox-API-Arg',
              JSON.stringify({ url: input }),
            )
            return fetch(
              'https://content.dropboxapi.com/2/sharing/get_shared_link_file',
              newInit,
            )
          })
          if (!response.ok) {
            throw new Error(await getDescriptiveErrorMessage(response))
          }
          return response
        }
      },
      /**
       * #action
       */
      async validateToken(
        token: string,
        location: UriLocation,
      ): Promise<string> {
        return self.validateTokenWithProbe(
          token,
          authToken =>
            fetch(
              'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
              self.addAuthHeaderToInit(
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: location.uri }),
                },
                authToken,
              ),
            ),
          getDescriptiveErrorMessage,
        )
      },
    }))
}

export default stateModelFactory
export type DropboxOAuthStateModel = ReturnType<typeof stateModelFactory>
export type DropboxOAuthModel = Instance<DropboxOAuthStateModel>
