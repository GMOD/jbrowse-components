import { ConfigurationReference } from '@jbrowse/core/configuration'
import { UriLocation } from '@jbrowse/core/util/types'
import { Instance, types } from 'mobx-state-tree'
import { RemoteFile } from 'generic-filehandle'
import { DropboxOAuthInternetAccountConfigModel } from './configSchema'
import baseModel from '../OAuthModel/model'
import { configSchema as OAuthConfigSchema } from '../OAuthModel'

const stateModelFactory = (
  configSchema: DropboxOAuthInternetAccountConfigModel,
) => {
  return types
    .compose(
      'DropboxOAuthInternetAccount',
      baseModel(OAuthConfigSchema),
      types.model({
        id: 'DropboxOAuth',
        type: types.literal('DropboxOAuthInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(() => ({
      get internetAccountType() {
        return 'DropboxOAuthInternetAccount'
      },
    }))
    .actions(self => ({
      // for Dropbox, used to check if token is still valid
      async fetchFile(locationUri: string, accessToken: string) {
        if (!locationUri || !accessToken) {
          return
        }
        const response = await fetch(
          'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`, // the access token is getting cached or something here
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: locationUri,
            }),
          },
        )
        if (!response.ok) {
          throw new Error(
            `Network response failure: ${
              response.status
            } (${await response.text()})`,
          )
        }
        return locationUri
      },
      getFetcher(location: UriLocation) {
        return async (
          url: RequestInfo,
          opts?: RequestInit,
        ): Promise<Response> => {
          const preAuthInfo = self.uriToPreAuthInfoMap.get(location.uri)
          if (!preAuthInfo || !preAuthInfo.authInfo) {
            throw new Error(
              'Failed to obtain authorization information needed to fetch',
            )
          }

          let foundTokens = {
            token: '',
            refreshToken: '',
          }
          try {
            foundTokens = await self.checkToken(preAuthInfo.authInfo, {
              uri: String(url),
              locationType: 'UriLocation',
            })
          } catch (e) {
            await self.handleError(e)
          }

          const newOpts = opts || {}

          if (foundTokens.token) {
            const tokenInfoString = self.tokenType
              ? `${self.tokenType} ${foundTokens.token}`
              : `${foundTokens.token}`
            const headers = new Headers(opts?.headers)
            headers.append(self.authHeader, tokenInfoString)
            headers.append(
              'Dropbox-API-Arg',
              JSON.stringify({ url: location.uri }),
            )

            newOpts.headers = headers
          }

          return fetch(url, {
            method: 'GET',
            credentials: 'same-origin',
            ...newOpts,
          })
        }
      },
      openLocation(location: UriLocation) {
        const preAuthInfo =
          location.internetAccountPreAuthorization || self.generateAuthInfo()
        self.uriToPreAuthInfoMap.set(location.uri, preAuthInfo)
        return new RemoteFile(
          'https://content.dropboxapi.com/2/sharing/get_shared_link_file',
          { fetch: this.getFetcher(location) },
        )
      },
    }))
}

export default stateModelFactory
export type DropboxOAuthStateModel = ReturnType<typeof stateModelFactory>
export type DropboxOAuthModel = Instance<DropboxOAuthStateModel>
