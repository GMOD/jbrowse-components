import React from 'react'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { Instance, types } from 'mobx-state-tree'
import { UriLocation } from '@jbrowse/core/util/types'
import { SvgIconProps, SvgIcon } from '@mui/material'

// locals
import { GoogleDriveOAuthInternetAccountConfigModel } from './configSchema'
import baseModel from '../OAuthModel/model'
import { configSchema as OAuthConfigSchema } from '../OAuthModel'
import { getDescriptiveErrorMessage } from './util'
import { GoogleDriveFile } from './GoogleDriveFilehandle'

export interface RequestInitWithMetadata extends RequestInit {
  metadataOnly?: boolean
}

function GoogleDriveIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M7.71,3.5L1.15,15L4.58,21L11.13,9.5M9.73,15L6.3,21H19.42L22.85,15M22.28,14L15.42,2H8.58L8.57,2L15.43,14H22.28Z" />
    </SvgIcon>
  )
}

function getUri(str: string) {
  const urlId = str.match(/[-\w]{25,}/)
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
