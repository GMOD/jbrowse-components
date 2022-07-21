import React from 'react'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { Instance, types } from 'mobx-state-tree'
import { RemoteFileWithRangeCache } from '@jbrowse/core/util/io'
import { UriLocation } from '@jbrowse/core/util/types'
import { SvgIconProps, SvgIcon } from '@mui/material'
import {
  FilehandleOptions,
  Stats,
  PolyfilledResponse,
} from 'generic-filehandle'

// locals
import { GoogleDriveOAuthInternetAccountConfigModel } from './configSchema'
import baseModel from '../OAuthModel/model'
import { configSchema as OAuthConfigSchema } from '../OAuthModel'

interface RequestInitWithMetadata extends RequestInit {
  metadataOnly?: boolean
}

interface GoogleDriveFilehandleOptions extends FilehandleOptions {
  fetch(
    input: RequestInfo,
    opts?: RequestInitWithMetadata,
  ): Promise<PolyfilledResponse>
}

interface GoogleDriveError {
  error: {
    errors: {
      domain: string
      reason: string
      message: string
      locationType?: string
      location?: string
    }[]
    code: number
    message: string
  }
}

class GoogleDriveFile extends RemoteFileWithRangeCache {
  private statsPromise: Promise<{ size: number }>
  constructor(source: string, opts: GoogleDriveFilehandleOptions) {
    super(source, opts)
    this.statsPromise = this.fetch(source, {
      metadataOnly: true,
    }).then((response: Response) => response.json())
  }

  async fetch(
    input: RequestInfo,
    opts?: RequestInitWithMetadata,
  ): Promise<PolyfilledResponse> {
    return super.fetch(input, opts)
  }

  async stat(): Promise<Stats> {
    return this.statsPromise
  }
}

function GoogleDriveIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M7.71,3.5L1.15,15L4.58,21L11.13,9.5M9.73,15L6.3,21H19.42L22.85,15M22.28,14L15.42,2H8.58L8.57,2L15.43,14H22.28Z" />
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
    let errorMessageParsed: GoogleDriveError | undefined
    try {
      errorMessageParsed = JSON.parse(errorMessage)
    } catch (error) {
      errorMessageParsed = undefined
    }
    if (errorMessageParsed) {
      errorMessage = errorMessageParsed.error.message
    }
  }
  return `Network response failure — ${response.status} (${
    response.statusText
  })${errorMessage ? ` (${errorMessage})` : ''}`
}

const stateModelFactory = (
  configSchema: GoogleDriveOAuthInternetAccountConfigModel,
) => {
  return types
    .compose(
      'GoogleDriveOAuthInternetAccount',
      baseModel(OAuthConfigSchema),
      types.model({
        type: types.literal('GoogleDriveOAuthInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(() => ({
      get toggleContents() {
        return <GoogleDriveIcon />
      },
      get selectorLabel() {
        return 'Enter Google Drive share link'
      },
    }))
    .actions(self => ({
      getFetcher(
        location?: UriLocation,
      ): (input: RequestInfo, init?: RequestInit) => Promise<Response> {
        return async (
          input: RequestInfo,
          init?: RequestInitWithMetadata,
        ): Promise<Response> => {
          const urlId = String(input).match(/[-\w]{25,}/)
          const driveUrl = new URL(
            `https://www.googleapis.com/drive/v3/files/${urlId}`,
          )
          const searchParams = new URLSearchParams()
          if (init?.metadataOnly) {
            searchParams.append('fields', 'size')
          } else {
            searchParams.append('alt', 'media')
          }
          driveUrl.search = searchParams.toString()
          const authToken = await self.getToken(location)
          const newInit = self.addAuthHeaderToInit(
            { ...init, method: 'GET', credentials: 'same-origin' },
            authToken,
          )
          const response = await fetch(driveUrl.toString(), newInit)
          if (!response.ok) {
            const message = await getDescriptiveErrorMessage(response)
            throw new Error(message)
          }
          return response
        }
      },
      openLocation(location: UriLocation) {
        return new GoogleDriveFile(location.uri, {
          fetch: this.getFetcher(location),
        })
      },
      async validateToken(
        token: string,
        location: UriLocation,
      ): Promise<string> {
        const urlId = location.uri.match(/[-\w]{25,}/)
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${urlId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        )
        if (!response.ok) {
          const message = await getDescriptiveErrorMessage(response)
          throw new Error(`Token could not be validated. ${message}`)
        }
        return token
      },
    }))
}

export default stateModelFactory
export type GoogleDriveOAuthStateModel = ReturnType<typeof stateModelFactory>
export type GoogleDriveOAuthModel = Instance<GoogleDriveOAuthStateModel>
