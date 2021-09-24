import { ConfigurationReference } from '@jbrowse/core/configuration'
import { UriLocation } from '@jbrowse/core/util/types'
import { Instance, types } from 'mobx-state-tree'
import { RemoteFile } from 'generic-filehandle'
import { DropboxOAuthInternetAccountConfigModel } from './configSchema'
import baseModel from '../OAuthModel/model'
import { configSchema as OAuthConfigSchema } from '../OAuthModel'

interface DropboxError {
  error_summary: string
  error: {
    '.tag': string
  }
}

// Error messages from https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_shared_link_file
const dropboxErrorMessages: Record<string, string | undefined> = {
  shared_link_not_found: "The shared link wasn't found.",
  shared_link_access_denied:
    'The caller is not allowed to access this shared link.',
  unsupported_link_type:
    'This type of link is not supported; use files/export instead.',
  shared_link_is_directory: 'Directories cannot be retrieved by this endpoint.',
}

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
      async processBadResponse(response: Response) {
        let errorMessage
        try {
          errorMessage = await response.text()
        } catch (error) {
          errorMessage = ''
        }
        if (errorMessage) {
          let errorMessageParsed: DropboxError | undefined
          try {
            errorMessageParsed = JSON.parse(errorMessage)
          } catch (error) {
            errorMessageParsed = undefined
          }
          if (errorMessageParsed) {
            const messageTag = errorMessageParsed.error['.tag']
            errorMessage = dropboxErrorMessages[messageTag] || messageTag
          }
        }
        throw new Error(
          `Network response failure — ${response.status} (${errorMessage})`,
        )
      },
      // for Dropbox, used to check if token is still valid for the file
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
          await this.processBadResponse(response)
        }
        return locationUri
      },
      async dropboxFetch(
        url: RequestInfo,
        opts?: RequestInit,
      ): Promise<Response> {
        const preAuthInfo = self.uriToPreAuthInfoMap.get(url)
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
          headers.append('Dropbox-API-Arg', JSON.stringify({ url }))

          newOpts.headers = headers
        }

        const response = await fetch(
          'https://content.dropboxapi.com/2/sharing/get_shared_link_file',
          { method: 'GET', credentials: 'same-origin', ...newOpts },
        )
        if (!response.ok) {
          await this.processBadResponse(response)
        }
        return response
      },
      openLocation(location: UriLocation) {
        const preAuthInfo =
          location.internetAccountPreAuthorization || self.generateAuthInfo()
        self.uriToPreAuthInfoMap.set(location.uri, preAuthInfo)
        return new RemoteFile(location.uri, {
          fetch: this.dropboxFetch,
        })
      },
    }))
}

export default stateModelFactory
export type DropboxOAuthStateModel = ReturnType<typeof stateModelFactory>
export type DropboxOAuthModel = Instance<DropboxOAuthStateModel>
