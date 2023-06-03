import React from 'react'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { UriLocation } from '@jbrowse/core/util/types'
import { SvgIconProps, SvgIcon } from '@mui/material'
import { Instance, types } from 'mobx-state-tree'

// locals
import { DropboxOAuthInternetAccountConfigModel } from './configSchema'
import baseModel from '../OAuthModel/model'
import { configSchema as OAuthConfigSchema } from '../OAuthModel'
import { getDescriptiveErrorMessage } from './util'

export function DropboxIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 6.2L8 9.39L13 6.2L8 3L3 6.2M13 6.2L18 9.39L23 6.2L18 3L13 6.2M3 12.55L8 15.74L13 12.55L8 9.35L3 12.55M18 9.35L13 12.55L18 15.74L23 12.55L18 9.35M8.03 16.8L13.04 20L18.04 16.8L13.04 13.61L8.03 16.8Z" />
    </SvgIcon>
  )
}

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
          const refreshToken =
            self.hasRefreshToken && self.retrieveRefreshToken()
          if (refreshToken) {
            self.removeRefreshToken()
            const newToken = await self.exchangeRefreshForAccessToken(
              refreshToken,
            )
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
