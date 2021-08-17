import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { OAuthInternetAccountConfigModel } from './configSchema'
import crypto from 'crypto'
import { Instance, types } from 'mobx-state-tree'
import { UriLocation } from '@jbrowse/core/util/types'
import { RemoteFile } from 'generic-filehandle'

interface OAuthData {
  client_id: string
  redirect_uri: string
  response_type: 'token' | 'code'
  scope?: string
  code_challenge?: string
  code_challenge_method?: string
  token_access_type?: string
}

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: OAuthInternetAccountConfigModel,
) => {
  return types
    .compose(
      'OAuthInternetAccount',
      InternetAccount,
      types.model({
        id: 'OAuth',
        type: types.literal('OAuthInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      authorizationCode: '',
      codeVerifierPKCE: '',
      errorMessage: '',
    }))
    .views(self => ({
      get tokenType() {
        return getConf(self, 'tokenType') || 'Bearer'
      },
      get internetAccountType() {
        return 'OAuthInternetAccount'
      },
      handlesLocation(location: UriLocation): boolean {
        const validDomains = self.accountConfig.validDomains || []
        return validDomains.some((domain: string) =>
          location?.uri.includes(domain),
        )
      },
      get generateAuthInfo() {
        return {
          internetAccountType: this.internetAccountType,
          authInfo: {
            authHeader: self.authHeader,
            tokenType: this.tokenType,
            origin: self.origin,
            configuration: self.accountConfig,
          },
        }
      },
    }))
    .actions(self => ({
      setCodeVerifierPKCE(codeVerifier: string) {
        self.codeVerifierPKCE = codeVerifier
      },
      setErrorMessage(message: string) {
        self.errorMessage = message
      },
      async useEndpointForAuthorization() {
        const config = self.accountConfig
        const data: OAuthData = {
          client_id: config.clientId,
          redirect_uri: 'http://localhost:3000',
          response_type: config.responseType || 'code',
        }

        if (config.scopes) {
          data.scope = config.scopes
        }

        if (config.needsPKCE) {
          const base64Encode = (buf: Buffer) => {
            return buf
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '')
          }
          const codeVerifier = base64Encode(crypto.randomBytes(32))
          const sha256 = (str: string) => {
            return crypto.createHash('sha256').update(str).digest()
          }
          const codeChallenge = base64Encode(sha256(codeVerifier))
          data.code_challenge = codeChallenge
          data.code_challenge_method = 'S256'

          this.setCodeVerifierPKCE(codeVerifier)
        }

        if (config.hasRefreshToken) {
          data.token_access_type = 'offline'
        }

        const params = Object.entries(data)
          .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
          .join('&')

        const url = `${config.authEndpoint}?${params}`
        const options = `width=500,height=600,left=0,top=0`
        return window.open(
          url,
          `JBrowseAuthWindow-${self.internetAccountId}`,
          options,
        )
      },
    }))
    .actions(self => {
      let resolve: Function = () => {}
      let reject: Function = () => {}
      let openLocationPromise: Promise<string> | undefined = undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let preAuthInfo: any = {}
      return {
        async setAccessTokenInfo(token: string, generateNew = false) {
          if (generateNew && token) {
            sessionStorage.setItem(`${self.internetAccountId}-token`, token)
          }

          if (!token) {
            reject()
          } else {
            resolve(token)
          }

          resolve = () => {}
          reject = () => {}
          this.deleteMessageChannel()
        },
        async checkToken() {
          let token =
            preAuthInfo?.authInfo?.token ||
            sessionStorage.getItem(`${self.internetAccountId}-token`)

          const refreshToken =
            preAuthInfo.authInfo?.token ||
            localStorage.getItem(`${self.internetAccountId}-refreshToken`)

          if (!token) {
            if (!openLocationPromise) {
              openLocationPromise = new Promise(async (r, x) => {
                this.addMessageChannel()
                self.useEndpointForAuthorization()
                resolve = r
                reject = x
              })
              token = await openLocationPromise
            }
          }

          if (!preAuthInfo.authInfo.token) {
            preAuthInfo.authInfo.token = token
          }
          if (!preAuthInfo.authInfo.refreshToken && refreshToken) {
            preAuthInfo.authInfo.refreshToken = refreshToken
          }
          resolve()
          openLocationPromise = undefined
          return token
        },
        setAuthorizationCode(code: string) {
          self.authorizationCode = code
        },
        setRefreshToken(token: string) {
          const refreshTokenKey = `${self.internetAccountId}-refreshToken`
          const existingToken = localStorage.getItem(refreshTokenKey)
          if (!existingToken) {
            localStorage.setItem(
              `${self.internetAccountId}-refreshToken`,
              token,
            )
          }

          if (!preAuthInfo.authInfo.refreshToken) {
            preAuthInfo.authInfo.refreshToken = token
          }
        },
        async exchangeAuthorizationForAccessToken(token: string) {
          const config = self.accountConfig
          const data = {
            code: token,
            grant_type: 'authorization_code',
            client_id: config.clientId,
            code_verifier: self.codeVerifierPKCE,
            redirect_uri: 'http://localhost:3000',
          }

          const params = Object.entries(data)
            .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
            .join('&')

          const response = await fetch(`${config.tokenEndpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
          })

          const accessToken = await response.json()
          this.setAccessTokenInfo(accessToken.access_token, true)
          if (accessToken.refresh_token) {
            this.setRefreshToken(accessToken.refresh_token)
          }
        },
        async exchangeRefreshForAccessToken() {
          const foundRefreshToken =
            preAuthInfo?.authInfo?.refreshToken ||
            localStorage.getItem(`${self.internetAccountId}-refreshToken`)

          if (foundRefreshToken) {
            // need to set it so
            // checks if it from webworker, and if it is use preauth config info
            const config = self.accountConfig
            const data = {
              grant_type: 'refresh_token',
              refresh_token: foundRefreshToken,
              client_id: config.clientId,
            }

            const params = Object.entries(data)
              .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
              .join('&')

            const response = await fetch(`${config.tokenEndpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: params,
            })

            if (!response.ok) {
              if (localStorage) {
                // need indicator of from fetch or not
                localStorage.removeItem(
                  `${self.internetAccountId}-refreshToken`,
                )
              }
              throw new Error(
                `Network response failure: ${
                  response.status
                } (${await response.text()})`,
              )
            }

            const accessToken = await response.json()
            this.setAccessTokenInfo(accessToken.access_token, true)
            return accessToken
          } else {
            throw new Error(
              `Malformed or expired access token, and refresh token not found`,
            )
          }
        },
        async fetchFile(location: string, accessToken: string) {
          if (!location || !accessToken) {
            return
          }
          const findOrigin = preAuthInfo.authInfo.origin || self.origin
          switch (findOrigin) {
            case 'dropbox': {
              const response = await fetch(
                'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${accessToken}`, // the access token is getting cached or something here
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    url: location,
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
              const metadata = await response.json()
              if (metadata) {
                const fileResponse = await fetch(
                  'https://api.dropboxapi.com/2/files/get_temporary_link',
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ path: metadata.id }),
                  },
                )
                if (!fileResponse.ok) {
                  throw new Error(
                    `Network response failure: ${
                      fileResponse.status
                    } (${await fileResponse.text()})`,
                  )
                }
                const file = await fileResponse.json()
                return file.link
              }
              break
            }
            case 'google': {
              const urlId = location.match(/[-\w]{25,}/)

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
              const fileMetadata = await response.json()
              return fileMetadata.downloadUrl
            }
          }
        },
        addMessageChannel() {
          window.addEventListener('message', this.finishOAuthWindow)
        },
        deleteMessageChannel() {
          window.removeEventListener('message', this.finishOAuthWindow)
        },
        finishOAuthWindow(event: MessageEvent) {
          if (
            event.data.name === `JBrowseAuthWindow-${self.internetAccountId}`
          ) {
            if (event.data.redirectUri.includes('access_token')) {
              const fixedQueryString = event.data.redirectUri.replace('#', '?')
              const queryStringSearch = new URL(fixedQueryString).search
              const urlParams = new URLSearchParams(queryStringSearch)
              const token = urlParams.get('access_token')
              if (!token) {
                self.setErrorMessage('Error fetching token')
                reject(self.errorMessage)
                openLocationPromise = undefined
                return
              }
              this.setAccessTokenInfo(token, true)
            }
            if (event.data.redirectUri.includes('code')) {
              const queryString = new URL(event.data.redirectUri).search
              const urlParams = new URLSearchParams(queryString)
              const code = urlParams.get('code')
              if (!code) {
                self.setErrorMessage('Error fetching code')
                reject(self.errorMessage)
                openLocationPromise = undefined
                return
              }
              this.exchangeAuthorizationForAccessToken(code)
            }
            if (event.data.redirectUri.includes('access_denied')) {
              self.setErrorMessage('User cancelled OAuth flow')
              reject(self.errorMessage)
              openLocationPromise = undefined
              return
            }
          }
        },

        // if you are in the worker, and no preauth information available throw new error

        // called from RpcMethodType, fills in the internetAccountPreAuthorization
        // should be undefined coming in, and should have origin, tokenType, authHeader
        // token and fileUrl (the actual url to open) when finished

        // on error it tries again once if there is a refresh token available
        async getPreAuthorizationInformation(
          location: UriLocation,
          retried = false,
        ) {
          if (!preAuthInfo.authInfo) {
            preAuthInfo = self.generateAuthInfo
          }

          // if in worker && !location.preauthInto throw new error
          if (
            typeof sessionStorage === 'undefined' &&
            !location.internetAccountPreAuthorization
          ) {
            throw new Error('Error')
          }
          let accessToken
          try {
            accessToken = await this.checkToken()
          } catch (error) {
            await this.handleError(error, retried)
          }

          if (accessToken) {
            let fileUrl
            try {
              fileUrl = await this.fetchFile(location.uri, accessToken)
              preAuthInfo.authInfo.fileUrl = fileUrl
            } catch (error) {
              await this.handleError(error, retried)
              if (!retried) {
                await this.getPreAuthorizationInformation(location, true)
              }
            }
          }

          return preAuthInfo
        },
        async getFetcher(
          url: RequestInfo,
          opts?: RequestInit,
        ): Promise<Response> {
          if (!preAuthInfo || !preAuthInfo.authInfo) {
            throw new Error('Auth Information Missing')
          }

          let fileUrl = preAuthInfo.authInfo.fileUrl
          let foundToken
          try {
            foundToken = await this.checkToken()
          } catch (e) {
            await this.handleError(e)
          }
          let newOpts = opts

          if (foundToken) {
            if (!fileUrl) {
              try {
                fileUrl = await this.fetchFile(String(url), foundToken)
              } catch (e) {
                await this.handleError(e)
              }
            }
            const newHeaders = {
              ...opts?.headers,
              [self.authHeader]: `${self.tokenType} ${preAuthInfo.authInfo.token}`,
            }
            newOpts = {
              ...opts,
              headers: newHeaders,
            }
          }

          return fetch(fileUrl, {
            method: 'GET',
            credentials: 'same-origin',
            ...newOpts,
          })
        },
        // called on the web worker, returns a generic filehandle with a modified fetch
        // preauth info should be filled in by here
        openLocation(location: UriLocation) {
          preAuthInfo =
            location.internetAccountPreAuthorization || self.generateAuthInfo
          return new RemoteFile(String(location.uri), {
            fetch: this.getFetcher,
          })
        },
        async handleError(error: string, triedRefreshToken = false) {
          if (typeof sessionStorage !== 'undefined') {
            preAuthInfo = self.generateAuthInfo // if it reaches here the token was bad
            sessionStorage.removeItem(`${self.internetAccountId}-token`)
          }
          if (!triedRefreshToken) {
            await this.exchangeRefreshForAccessToken()
          } else {
            throw new Error(error)
          }
        },
      }
    })
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
