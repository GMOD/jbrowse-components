import React from 'react'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

// locals
import { configSchema as OAuthConfigSchema } from '../OAuthModel'
import DropboxIcon from './DropboxIcon'
import { getDescriptiveErrorMessage } from './util'
import baseModel from '../OAuthModel/model'
import type { DropboxOAuthInternetAccountConfigModel } from './configSchema'
import type { UriLocation } from '@jbrowse/core/util/types'
import type { Instance } from 'mobx-state-tree'

/**
 * #stateModel DropboxOAuthInternetAccount
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
    .views(() => ({
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
    }))
    .actions(self => ({
      /**
       * #method
       */
      getFetcher(location?: UriLocation) {
        return async (input: RequestInfo, init?: RequestInit) => {
          const authToken = await self.getToken(location)
          const newInit = self.addAuthHeaderToInit(
            { ...init, method: 'POST' },
            authToken,
          )
          newInit.headers.append(
            'Dropbox-API-Arg',
            JSON.stringify({ url: input }),
          )
          const response = await fetch(
            'https://content.dropboxapi.com/2/sharing/get_shared_link_file',
            newInit,
          )
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
        const response = await fetch(
          'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: location.uri,
            }),
          },
        )
        if (!response.ok) {
          const refreshToken = self.retrieveRefreshToken()
          if (refreshToken) {
            self.removeRefreshToken()
            const newToken =
              await self.exchangeRefreshForAccessToken(refreshToken)
            return this.validateToken(newToken, location)
          }
          throw new Error(
            await getDescriptiveErrorMessage(
              response,
              'Token could not be validated',
            ),
          )
        }
        return token
      },
    }))
}

export default stateModelFactory
export type DropboxOAuthStateModel = ReturnType<typeof stateModelFactory>
export type DropboxOAuthModel = Instance<DropboxOAuthStateModel>
