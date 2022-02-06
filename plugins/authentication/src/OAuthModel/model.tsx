import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { isElectron } from '@jbrowse/core/util'
import sha256 from 'crypto-js/sha256'
import Base64 from 'crypto-js/enc-base64'
import { Instance, types } from 'mobx-state-tree'
import { RemoteFileWithRangeCache } from '@jbrowse/core/util/io'
import { UriLocation } from '@jbrowse/core/util/types'

// locals
import { OAuthInternetAccountConfigModel } from './configSchema'

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
      get authHeader(): string {
        return getConf(self, 'authHeader') || 'Authorization'
      },
      get tokenType(): string {
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
            redirectUri: window.location.origin + window.location.pathname,
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
    .volatile(() => ({
      uriToPreAuthInfoMap: new Map(),
    }))
    .actions(self => {
      let resolve: Function = () => {}
      let reject: Function = () => {}
      let openLocationPromise: Promise<string> | undefined = undefined
      return {
        // opens external OAuth flow, popup for web and new browser window for desktop
        async useEndpointForAuthorization(location: UriLocation) {
          const determineRedirectUri = () => {
            if (!inWebWorker) {
              if (isElectron) {
                return 'http://localhost/auth'
              } else {
                return window.location.origin + window.location.pathname
              }
            } else {
              return self.uriToPreAuthInfoMap.get(location.uri)?.authInfo
                ?.redirectUri
            }
          }
          const config = self.accountConfig
          const data: OAuthData = {
            client_id: config.clientId,
            redirect_uri: determineRedirectUri(),
            response_type: config.responseType || 'code',
          }

          if (config.scopes) {
            data.scope = config.scopes
          }

          if (config.needsPKCE) {
            const fixup = (buf: string) => {
              return buf
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '')
            }
            const array = new Uint8Array(32)
            window.crypto.getRandomValues(array)
            const codeVerifier = fixup(Buffer.from(array).toString('base64'))
            const codeChallenge = fixup(Base64.stringify(sha256(codeVerifier)))
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
        async checkToken(
          authInfo: { token: string; refreshToken: string },
          location: UriLocation,
        ) {
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
              token = await this.exchangeRefreshForAccessToken(location)
            } else {
              if (!openLocationPromise) {
                openLocationPromise = new Promise(async (r, x) => {
                  this.addMessageChannel()
                  this.useEndpointForAuthorization(location)
                  resolve = r
                  reject = x
                })
              }
              token = await openLocationPromise
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
        async exchangeAuthorizationForAccessToken(
          token: string,
          redirectUri: string,
        ) {
          const config = self.accountConfig
          const data = {
            code: token,
            grant_type: 'authorization_code',
            client_id: config.clientId,
            code_verifier: self.codeVerifierPKCE,
            redirect_uri: redirectUri,
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
            resolve()
            await this.handleError('Failed to obtain token from endpoint')
          }

          const accessToken = await response.json()
          if (!inWebWorker) {
            this.setAccessTokenInfo(accessToken.access_token, true)
            if (accessToken.refresh_token) {
              this.setRefreshToken(accessToken.refresh_token)
            }
          }
        },
        async exchangeRefreshForAccessToken(location: UriLocation) {
          const foundRefreshToken =
            self.uriToPreAuthInfoMap.get(location.uri)?.authInfo
              ?.refreshToken ||
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
            const redirectUriWithInfo = event.data.redirectUri
            if (redirectUriWithInfo.includes('access_token')) {
              const fixedQueryString = redirectUriWithInfo.replace('#', '?')
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
            if (redirectUriWithInfo.includes('code')) {
              const redirectUri = new URL(redirectUriWithInfo)
              const queryString = redirectUri.search
              const urlParams = new URLSearchParams(queryString)
              const code = urlParams.get('code')
              if (!code) {
                self.setErrorMessage('Error with authorization endpoint')
                reject(self.errorMessage)
                openLocationPromise = undefined
                return
              }
              this.exchangeAuthorizationForAccessToken(
                code,
                redirectUri.origin + redirectUri.pathname,
              )
            }
            if (redirectUriWithInfo.includes('access_denied')) {
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
          const preAuthInfo = self.uriToPreAuthInfoMap.get(url)
          if (!preAuthInfo || !preAuthInfo.authInfo) {
            throw new Error(
              `Failed to obtain authorization information needed to fetch ${
                inWebWorker ? '. Try reloading the page' : ''
              }`,
            )
          }

          let fileUrl = preAuthInfo.authInfo.fileUrl
          let foundTokens = {
            token: '',
            refreshToken: '',
          }
          try {
            foundTokens = await this.checkToken(preAuthInfo.authInfo, {
              uri: String(url),
              locationType: 'UriLocation',
            })
          } catch (e) {
            await this.handleError(e as string)
          }
          let newOpts = opts

          if (foundTokens.token) {
            if (!fileUrl) {
              try {
                fileUrl = await self.fetchFile(String(url), foundTokens.token)
              } catch (e) {
                await this.handleError(e as string)
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
          const preAuthInfo =
            location.internetAccountPreAuthorization || self.generateAuthInfo()
          self.uriToPreAuthInfoMap.set(location.uri, preAuthInfo)
          return new RemoteFileWithRangeCache(String(location.uri), {
            fetch: this.getFetcher,
          })
        },
        // fills in a locations preauth information with all necessary information
        async getPreAuthorizationInformation(
          location: UriLocation,
          retried = false,
        ) {
          if (!self.uriToPreAuthInfoMap.get(location.uri)) {
            self.uriToPreAuthInfoMap.set(location.uri, self.generateAuthInfo())
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
              self.uriToPreAuthInfoMap.get(location.uri).authInfo,
              location,
            )
            self.uriToPreAuthInfoMap.set(location.uri, {
              ...self.uriToPreAuthInfoMap.get(location.uri),
              authInfo: {
                ...self.uriToPreAuthInfoMap.get(location.uri).authInfo,
                token: foundTokens.token,
                refreshToken: foundTokens.refreshToken,
              },
            })
          } catch (error) {
            await this.handleError(error as string, retried)
          }

          if (foundTokens.token) {
            let fileUrl = self.uriToPreAuthInfoMap.get(location.uri).authInfo
              ?.fileUrl
            if (!fileUrl) {
              try {
                fileUrl = await self.fetchFile(location.uri, foundTokens.token)
                self.uriToPreAuthInfoMap.set(location.uri, {
                  ...self.uriToPreAuthInfoMap.get(location.uri),
                  authInfo: {
                    ...self.uriToPreAuthInfoMap.get(location.uri).authInfo,
                    fileUrl: fileUrl,
                  },
                })
              } catch (error) {
                await this.handleError(error as string, retried, location)
                if (!retried) {
                  await this.getPreAuthorizationInformation(location, true)
                }
              }
            }
          }
          return self.uriToPreAuthInfoMap.get(location.uri)
        },
        // in the error message to the flow above, add a conditional that is like
        // if inWebWorker try to reload the page
        async handleError(
          error: string,
          triedRefreshToken = false,
          location?: UriLocation,
        ) {
          if (!inWebWorker && location) {
            sessionStorage.removeItem(`${self.internetAccountId}-token`)
            self.uriToPreAuthInfoMap.set(location.uri, self.generateAuthInfo()) // if it reaches here the token was bad
          }
          if (!triedRefreshToken && location) {
            await this.exchangeRefreshForAccessToken(location)
          } else {
            throw error
          }
        },
      }
    })
}

export default stateModelFactory
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
