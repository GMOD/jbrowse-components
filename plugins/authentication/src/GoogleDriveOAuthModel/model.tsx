import React from 'react'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { Instance, types } from 'mobx-state-tree'
import { RemoteFileWithRangeCache } from '@jbrowse/core/util/io'
import { UriLocation } from '@jbrowse/core/util/types'
import { SvgIconProps, SvgIcon } from '@material-ui/core'
import {
  FilehandleOptions,
  Stats,
  PolyfilledResponse,
} from 'generic-filehandle'
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
      get toggleContents() {
        return <GoogleDriveIcon />
      },
      get selectorLabel() {
        return 'Enter Google Drive share link'
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
        throw new Error(
          `Network response failure — ${response.status} (${errorMessage})`,
        )
      },
      // used to check if token is still valid for the file
      async fetchFile(locationUri: string, accessToken: string) {
        if (!locationUri || !accessToken) {
          return
        }
        const urlId = locationUri.match(/[-\w]{25,}/)

        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${urlId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        )

        if (!response.ok) {
          await this.processBadResponse(response)
        }
        return locationUri
      },
      async googleDriveFetch(
        url: RequestInfo,
        opts?: RequestInitWithMetadata,
      ): Promise<Response> {
        const urlId = String(url).match(/[-\w]{25,}/)

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

        const newOpts: RequestInit = opts || {}

        if (foundTokens.token) {
          const tokenInfoString = self.tokenType
            ? `${self.tokenType} ${foundTokens.token}`
            : `${foundTokens.token}`
          const headers = new Headers(opts?.headers)
          headers.append(self.authHeader, tokenInfoString)

          newOpts.headers = headers
        }

        const driveUrl = `https://www.googleapis.com/drive/v3/files/${urlId}?${
          opts?.metadataOnly ? 'fields=size' : 'alt=media'
        }`
        const response = await fetch(driveUrl, {
          method: 'GET',
          credentials: 'same-origin',
          ...newOpts,
        })
        if (!response.ok) {
          await this.processBadResponse(response)
        }
        return response
      },
      openLocation(location: UriLocation) {
        const preAuthInfo =
          location.internetAccountPreAuthorization || self.generateAuthInfo()
        self.uriToPreAuthInfoMap.set(location.uri, preAuthInfo)
        return new GoogleDriveFile(location.uri, {
          fetch: this.googleDriveFetch,
        })
      },
    }))
}

export default stateModelFactory
export type GoogleDriveOAuthStateModel = ReturnType<typeof stateModelFactory>
export type GoogleDriveOAuthModel = Instance<GoogleDriveOAuthStateModel>
