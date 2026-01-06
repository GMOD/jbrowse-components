import { ConfigurationReference } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { GoogleDriveFile } from './GoogleDriveFilehandle.ts'
import GoogleDriveIcon from './GoogleDriveIcon.tsx'
import { getDescriptiveErrorMessage } from './util.ts'
import { configSchema as OAuthConfigSchema } from '../OAuthModel/index.ts'
import baseModel from '../OAuthModel/model.tsx'

import type { GoogleDriveOAuthInternetAccountConfigModel } from './configSchema.ts'
import type { UriLocation } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface RequestInitWithMetadata extends RequestInit {
  metadataOnly?: boolean
}

function getUri(str: string) {
  const urlId = /[-\w]{25,}/.exec(str)
  return `https://www.googleapis.com/drive/v3/files/${urlId}`
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
          if (init?.metadataOnly) {
            searchParams.append('fields', 'size')
          } else {
            searchParams.append('alt', 'media')
          }
          driveUrl.search = searchParams.toString()
          const authToken = await self.getToken(location)
          const response = await fetch(
            driveUrl,
            self.addAuthHeaderToInit(
              { ...init, method: 'GET', credentials: 'same-origin' },
              authToken,
            ),
          )
          if (!response.ok) {
            throw new Error(await getDescriptiveErrorMessage(response))
          }
          return response
        }
      },
      /**
       * #method
       */
      openLocation(location: UriLocation) {
        return new GoogleDriveFile(location.uri, {
          fetch: this.getFetcher(location),
        })
      },
      /**
       * #action
       */
      async validateToken(token: string, location: UriLocation) {
        const response = await fetch(getUri(location.uri), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
        if (!response.ok) {
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

export type GoogleDriveOAuthStateModel = ReturnType<typeof stateModelFactory>
export type GoogleDriveOAuthModel = Instance<GoogleDriveOAuthStateModel>
