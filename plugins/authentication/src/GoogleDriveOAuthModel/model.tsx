import { ConfigurationReference } from '@jbrowse/core/configuration'
import { Instance, types } from 'mobx-state-tree'
import { UriLocation } from '@jbrowse/core/util/types'
import { RemoteFile, FilehandleOptions, Stats } from 'generic-filehandle'
import { GoogleDriveOAuthInternetAccountConfigModel } from './configSchema'
import baseModel from '../OAuthModel/model'
import { configSchema as OAuthConfigSchema } from '../OAuthModel'

interface GoogleDriveFilehandleOptions extends FilehandleOptions {
  sizeFetch: Function
}

class GoogleDriveFile extends RemoteFile {
  private statsPromise: Promise<{ size: number }>
  constructor(source: string, opts: GoogleDriveFilehandleOptions) {
    super(source, opts)
    this.statsPromise = opts
      .sizeFetch(source)
      .then((response: Response) => response.json())
  }

  async stat(): Promise<Stats> {
    return this.statsPromise
  }
}

const stateModelFactory = (
  configSchema: GoogleDriveOAuthInternetAccountConfigModel,
) => {
  return types
    .compose(
      'GoogleDriveOAuthInternetAccount',
      baseModel(OAuthConfigSchema),
      types.model({
        id: 'GoogleDriveOAuth',
        type: types.literal('GoogleDriveOAuthInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(() => ({
      get internetAccountType() {
        return 'GoogleDriveOAuthInternetAccount'
      },
    }))
    .actions(self => ({
      // used to check if token is still valid for the file
      async fetchFile(locationUri: string, accessToken: string) {
        if (!locationUri || !accessToken) {
          return
        }
        const urlId = locationUri.match(/[-\w]{25,}/)

        const response = await fetch(
          `https://www.googleapis.com/drive/v2/files/${urlId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
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
      getFetcher(location: UriLocation, metadataOnly = false) {
        return async (
          url: RequestInfo,
          opts?: RequestInit,
        ): Promise<Response> => {
          const urlId = String(url).match(/[-\w]{25,}/)

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

            newOpts.headers = headers
          }

          const driveUrl = `https://www.googleapis.com/drive/v3/files/${urlId}?${
            metadataOnly ? 'fields=size' : 'alt=media'
          }`
          return fetch(driveUrl, {
            method: 'GET',
            credentials: 'same-origin',
            ...newOpts,
          })
        }
      },
      openLocation(location: UriLocation) {
        const urlId = String(location.uri).match(/[-\w]{25,}/)
        const preAuthInfo =
          location.internetAccountPreAuthorization || self.generateAuthInfo()
        self.uriToPreAuthInfoMap.set(location.uri, preAuthInfo)
        return new GoogleDriveFile(
          `https://www.googleapis.com/drive/v3/files/${urlId}?alt=media`,
          {
            fetch: this.getFetcher(location),
            sizeFetch: this.getFetcher(location, true),
          },
        )
      },
    }))
}

export default stateModelFactory
export type GoogleDriveOAuthStateModel = ReturnType<typeof stateModelFactory>
export type GoogleDriveOAuthModel = Instance<GoogleDriveOAuthStateModel>
