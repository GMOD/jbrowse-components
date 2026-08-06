import { ConfigurationReference } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { configSchema as OAuthConfigSchema } from '../OAuthModel/index.ts'
import baseModel from '../OAuthModel/model.tsx'
import DropboxIcon from './DropboxIcon.tsx'
import { getDescriptiveErrorMessage } from './util.ts'

import type { DropboxOAuthInternetAccountConfigModel } from './configSchema.ts'
import type { UriLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
        const fetchMetadata = (authToken: string) =>
          fetch(
            'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: location.uri,
              }),
            },
          )

        const response = await fetchMetadata(token)
        if (response.ok) {
          return token
        }
        const refreshToken = self.retrieveRefreshToken()
        if (!refreshToken) {
          throw new Error(
            await getDescriptiveErrorMessage(
              response,
              'Token could not be validated',
            ),
          )
        }
        // Retry exactly once. Recursing here instead looped forever on a link
        // that fails for a reason no new token fixes — a file the account
        // cannot see — refreshing against the token endpoint on every pass.
        const newToken = await self.exchangeRefreshForAccessToken(refreshToken)
        const retry = await fetchMetadata(newToken)
        if (!retry.ok) {
          throw new Error(
            await getDescriptiveErrorMessage(
              retry,
              'Token could not be validated',
            ),
          )
        }
        self.replaceToken(newToken)
        return newToken
      },
    }))
}

export default stateModelFactory
export type DropboxOAuthStateModel = ReturnType<typeof stateModelFactory>
export type DropboxOAuthModel = Instance<DropboxOAuthStateModel>
