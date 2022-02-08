import React from 'react'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { UriLocation } from '@jbrowse/core/util/types'
import { SvgIconProps, SvgIcon } from '@material-ui/core'
import { Instance, types } from 'mobx-state-tree'
import { DropboxOAuthInternetAccountConfigModel } from './configSchema'
import baseModel from '../OAuthModel/model'
import { configSchema as OAuthConfigSchema } from '../OAuthModel'

interface DropboxError {
  error_summary: string
  error: {
    '.tag': string
  }
}

/** Error messages from https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_shared_link_file */
const dropboxErrorMessages: Record<string, string | undefined> = {
  shared_link_not_found: "The shared link wasn't found.",
  shared_link_access_denied:
    'The caller is not allowed to access this shared link.',
  unsupported_link_type:
    'This type of link is not supported; use files/export instead.',
  shared_link_is_directory: 'Directories cannot be retrieved by this endpoint.',
}

export function DropboxIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3 6.2L8 9.39L13 6.2L8 3L3 6.2M13 6.2L18 9.39L23 6.2L18 3L13 6.2M3 12.55L8 15.74L13 12.55L8 9.35L3 12.55M18 9.35L13 12.55L18 15.74L23 12.55L18 9.35M8.03 16.8L13.04 20L18.04 16.8L13.04 13.61L8.03 16.8Z" />
    </SvgIcon>
  )
}

async function getDescriptiveErrorMessage(response: Response) {
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
  return `Network response failure — ${response.status} (${
    response.statusText
  })${errorMessage ? ` (${errorMessage})` : ''}`
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
      get toggleContents() {
        return <DropboxIcon />
      },
      get selectorLabel() {
        return 'Enter Dropbox share link'
      },
    }))
    .actions(self => ({
      getFetcher(
        location?: UriLocation,
      ): (input: RequestInfo, init?: RequestInit) => Promise<Response> {
        return async (
          input: RequestInfo,
          init?: RequestInit,
        ): Promise<Response> => {
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
            const message = await getDescriptiveErrorMessage(response)
            throw new Error(message)
          }
          return response
        }
      },
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
          const message = await getDescriptiveErrorMessage(response)
          throw new Error(`Token could not be validated. ${message}`)
        }
        return token
      },
    }))
}

export default stateModelFactory
export type DropboxOAuthStateModel = ReturnType<typeof stateModelFactory>
export type DropboxOAuthModel = Instance<DropboxOAuthStateModel>
