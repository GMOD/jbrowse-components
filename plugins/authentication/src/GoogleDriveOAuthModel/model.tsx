import { ConfigurationReference } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { configSchema as OAuthConfigSchema } from '../OAuthModel/index.ts'
import baseModel from '../OAuthModel/model.tsx'
import { GoogleDriveFile } from './GoogleDriveFilehandle.ts'
import GoogleDriveIcon from './GoogleDriveIcon.tsx'
import { getDescriptiveErrorMessage } from './util.ts'

import type { GoogleDriveOAuthInternetAccountConfigModel } from './configSchema.ts'
import type { UriLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

// metadataOnly: signals getFetcher to request ?fields=size instead of ?alt=media,
// used by GoogleDriveFile constructor to pre-fetch file size for stat()
export interface RequestInitWithMetadata extends RequestInit {
  metadataOnly?: boolean
}

function getUri(str: string) {
  const urlId = /\/d\/([-\w]{25,})/.exec(str)
  if (!urlId) {
    throw new Error(`Could not extract Google Drive file ID from URL: ${str}`)
  }
  return `https://www.googleapis.com/drive/v3/files/${urlId[1]}`
}

/**
 * #stateModel GoogleDriveOAuthInternetAccount
 */
export default function stateModelFactory(
  configSchema: GoogleDriveOAuthInternetAccountConfigModel,
) {
  return baseModel(OAuthConfigSchema)
    .named('GoogleDriveOAuthInternetAccount')
    .props({
      /**
       * #property
       */
      type: types.literal('GoogleDriveOAuthInternetAccount'),
      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),
    })
    .views(() => ({
      /**
       * #getter
       * The FileSelector icon for Google drive
       */
      get toggleContents() {
        return <GoogleDriveIcon />
      },
      /**
       * #getter
       */
      get selectorLabel() {
        return 'Enter Google Drive share link'
      },
    }))
    .actions(self => ({
      /**
       * #method
       */
      getFetcher(location?: UriLocation) {
        return async (input: RequestInfo, init?: RequestInitWithMetadata) => {
          const driveUrl = new URL(getUri(String(input)))
          const searchParams = new URLSearchParams()
          // metadataOnly: private flag used by GoogleDriveFile constructor to
          // pre-fetch just the file size for stat() without downloading content
          if (init?.metadataOnly) {
            searchParams.append('fields', 'size')
          } else {
            searchParams.append('alt', 'media')
          }
          driveUrl.search = searchParams.toString()
          const response = await self.fetchWithToken(location, authToken =>
            fetch(
              driveUrl,
              self.addAuthHeaderToInit(
                { ...init, method: 'GET', credentials: 'same-origin' },
                authToken,
              ),
            ),
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
      async validateToken(token: string, location: UriLocation) {
        const uri = getUri(location.uri)
        const fetchMetadata = (authToken: string) =>
          fetch(uri, { headers: { Authorization: `Bearer ${authToken}` } })

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
        // Retry exactly once. Recursing here instead looped forever on a file
        // that fails for a reason no new token fixes — one the account cannot
        // see — refreshing against the token endpoint on every pass.
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
    .actions(self => ({
      /**
       * #method
       */
      openLocation(location: UriLocation) {
        return new GoogleDriveFile(location.uri, {
          fetch: self.getFetcher(location),
        })
      },
    }))
}

export type GoogleDriveOAuthStateModel = ReturnType<typeof stateModelFactory>
export type GoogleDriveOAuthModel = Instance<GoogleDriveOAuthStateModel>
