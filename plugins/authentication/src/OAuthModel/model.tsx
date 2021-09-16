import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { isElectron } from '@jbrowse/core/util'

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

const inWebWorker = typeof sessionStorage === 'undefined'

const stateModelFactory = (configSchema: OAuthInternetAccountConfigModel) => {
  return types
    .compose(
      'OAuthInternetAccount',
      InternetAccount,
      types.model('OAuthModel', {
        id: 'OAuth',
        type: types.literal('OAuthInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      codeVerifierPKCE: '',
      errorMessage: '',
    }))
    .views(self => ({
      get authHeader() {
        return getConf(self, 'authHeader') || 'Authorization'
      },
      get tokenType() {
        return getConf(self, 'tokenType') || 'Bearer'
      },
      get internetAccountType() {
        return 'OAuthInternetAccount'
      },
      handlesLocation(location: UriLocation): boolean {
        const validDomains = self.accountConfig.domains || []
        return validDomains.some((domain: string) =>
          location?.uri.includes(domain),
        )
      },
      generateAuthInfo() {
        const generatedInfo = {
          internetAccountType: this.internetAccountType,
          authInfo: {
            authHeader: this.authHeader,
            tokenType: this.tokenType,
            configuration: self.accountConfig,
          },
        }
        return generatedInfo
      },
    }))
    .actions(self => ({
      setCodeVerifierPKCE(codeVerifier: string) {
        self.codeVerifierPKCE = codeVerifier
      },
      setErrorMessage(message: string) {
        self.errorMessage = message
      },
      async fetchFile(locationUri: string, accessToken: string) {
        if (!locationUri || !accessToken) {
          return
        }
        return locationUri
      },
    }))
    .actions(self => {
      let resolve: Function = () => {}
      let reject: Function = () => {}
      let openLocationPromise: Promise<string> | undefined = undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let preAuthInfo: any = {}
      const uriToPreAuthInfoMap = new Map()
      return {
        // opens external OAuth flow, popup for web and new browser window for desktop
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

            self.setCodeVerifierPKCE(codeVerifier)
          }

          if (config.hasRefreshToken) {
            data.token_access_type = 'offline'
          }

          const params = Object.entries(data)
            .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
            .join('&')

          const url = `${config.authEndpoint}?${params}`

          if (isElectron) {
            const model = self
            const electron = require('electron')
            const { ipcRenderer } = electron
            const redirectUri = await ipcRenderer.invoke('openAuthWindow', {
              internetAccountId: self.internetAccountId,
              data: data,
              url: url,
            })

            const eventFromDesktop = new MessageEvent('message', {
              data: {
                name: `JBrowseAuthWindow-${self.internetAccountId}`,
                redirectUri: redirectUri,
              },
            })
            // @ts-ignore
            model.finishOAuthWindow(eventFromDesktop)
            return
          } else {
            const options = `width=500,height=600,left=0,top=0`
            return window.open(
              url,
              `JBrowseAuthWindow-${self.internetAccountId}`,
              options,
            )
          }
        },
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
        async checkToken(authInfo: { token: string; refreshToken: string }) {
          let token =
            authInfo?.token ||
            (!inWebWorker
              ? (sessionStorage.getItem(
                  `${self.internetAccountId}-token`,
                ) as string)
              : '')
          const refreshToken =
            authInfo?.refreshToken ||
            (!inWebWorker
              ? (localStorage.getItem(
                  `${self.internetAccountId}-refreshToken`,
                ) as string)
              : '')

          if (!token) {
            if (refreshToken) {
              token = await this.exchangeRefreshForAccessToken()
            } else {
              if (!openLocationPromise) {
                openLocationPromise = new Promise(async (r, x) => {
                  this.addMessageChannel()
                  this.useEndpointForAuthorization()
                  resolve = r
                  reject = x
                })
                token = await openLocationPromise
              }
            }
          }
          resolve()
          openLocationPromise = undefined
          return { token, refreshToken }
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
          if (!inWebWorker) {
            this.setAccessTokenInfo(accessToken.access_token, true)
            if (accessToken.refresh_token) {
              this.setRefreshToken(accessToken.refresh_token)
            }
          }
        },
        async exchangeRefreshForAccessToken() {
          const foundRefreshToken =
            preAuthInfo.authInfo?.refreshToken ||
            (!inWebWorker
              ? localStorage.getItem(`${self.internetAccountId}-refreshToken`)
              : null)

          if (foundRefreshToken) {
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
              if (!inWebWorker) {
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
            if (!inWebWorker) {
              this.setAccessTokenInfo(accessToken.access_token, true)
            }
            return accessToken.access_token
          } else {
            throw new Error(
              `Malformed or expired access token, and refresh token not found`,
            )
          }
        },
        // used to listen to child window for auth code/token
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
            const redirectUri = event.data.redirectUri
            if (redirectUri.includes('access_token')) {
              const fixedQueryString = redirectUri.replace('#', '?')
              const queryStringSearch = new URL(fixedQueryString).search
              const urlParams = new URLSearchParams(queryStringSearch)
              const token = urlParams.get('access_token')
              if (!token) {
                self.setErrorMessage('Error with token endpoint')
                reject(self.errorMessage)
                openLocationPromise = undefined
                return
              }
              this.setAccessTokenInfo(token, true)
            }
            if (redirectUri.includes('code')) {
              const queryString = new URL(redirectUri).search
              const urlParams = new URLSearchParams(queryString)
              const code = urlParams.get('code')
              if (!code) {
                self.setErrorMessage('Error with authorization endpoint')
                reject(self.errorMessage)
                openLocationPromise = undefined
                return
              }
              this.exchangeAuthorizationForAccessToken(code)
            }
            if (redirectUri.includes('access_denied')) {
              self.setErrorMessage('OAuth flow was cancelled')
              reject(self.errorMessage)
              openLocationPromise = undefined
              return
            }
          }
        },
        // modified fetch that includes the headers
        async getFetcher(
          url: RequestInfo,
          opts?: RequestInit,
        ): Promise<Response> {
          if (!preAuthInfo || !preAuthInfo.authInfo) {
            throw new Error(
              'Failed to obtain authorization information needed to fetch',
            )
          }

          let fileUrl = preAuthInfo.authInfo.fileUrl
          let foundTokens = {
            token: '',
            refreshToken: '',
          }
          try {
            foundTokens = await this.checkToken(preAuthInfo.authInfo)
          } catch (e) {
            await this.handleError(e)
          }
          let newOpts = opts

          if (foundTokens.token) {
            if (!fileUrl) {
              try {
                fileUrl = await self.fetchFile(String(url), foundTokens.token)
              } catch (e) {
                await this.handleError(e)
              }
            }
            const tokenInfoString = self.tokenType
              ? `${self.tokenType} ${foundTokens.token}`
              : `${foundTokens.token}`
            const newHeaders = {
              ...opts?.headers,
              [self.authHeader]: `${tokenInfoString}`,
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
        openLocation(location: UriLocation) {
          preAuthInfo =
            location.internetAccountPreAuthorization || self.generateAuthInfo()
          return new RemoteFile(String(location.uri), {
            fetch: this.getFetcher,
          })
        },
        // fills in a locations preauth information with all necessary information
        async getPreAuthorizationInformation(
          location: UriLocation,
          retried = false,
        ) {
          if (!uriToPreAuthInfoMap.get(location.uri)) {
            uriToPreAuthInfoMap.set(location.uri, self.generateAuthInfo())
          }
          if (inWebWorker && !location.internetAccountPreAuthorization) {
            throw new Error(
              'Failed to obtain authorization information needed to fetch',
            )
          }

          let foundTokens = {
            token: '',
            refreshToken: '',
          }
          try {
            foundTokens = await this.checkToken(
              uriToPreAuthInfoMap.get(location.uri).authInfo,
            )
            uriToPreAuthInfoMap.set(location.uri, {
              ...uriToPreAuthInfoMap.get(location.uri),
              authInfo: {
                ...uriToPreAuthInfoMap.get(location.uri).authInfo,
                token: foundTokens.token,
                refreshToken: foundTokens.refreshToken,
              },
            })
          } catch (error) {
            await this.handleError(error, retried)
          }

          if (foundTokens.token) {
            let fileUrl = uriToPreAuthInfoMap.get(location.uri).authInfo
              ?.fileUrl
            if (!fileUrl) {
              try {
                fileUrl = await self.fetchFile(location.uri, foundTokens.token)
                uriToPreAuthInfoMap.set(location.uri, {
                  ...uriToPreAuthInfoMap.get(location.uri),
                  authInfo: {
                    ...uriToPreAuthInfoMap.get(location.uri).authInfo,
                    fileUrl: fileUrl,
                  },
                })
              } catch (error) {
                await this.handleError(error, retried, location)
                if (!retried) {
                  await this.getPreAuthorizationInformation(location, true)
                }
              }
            }
          }
          return uriToPreAuthInfoMap.get(location.uri)
        },
        async handleError(
          error: string,
          triedRefreshToken = false,
          location?: UriLocation,
        ) {
          if (!inWebWorker && location) {
            sessionStorage.removeItem(`${self.internetAccountId}-token`)
            uriToPreAuthInfoMap.set(location.uri, self.generateAuthInfo()) // if it reaches here the token was bad
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
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
