import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
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

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: OAuthInternetAccountConfigModel,
) => {
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
      return {
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

          // need the isElectron conditional to check desktop or web
          // if desktop use  https://auth0.com/blog/securing-electron-applications-with-openid-connect-and-oauth-2/
          // open new browser window
          if (isElectron) {
            const model = self
            const electron = require('electron')
            const { BrowserWindow } = electron.remote

            const win = new BrowserWindow({
              width: 1000,
              height: 600,
              webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: false,
              },
            })
            win.title = `JBrowseAuthWindow-${self.internetAccountId}`
            win.loadURL(url)

            win.webContents.on(
              'did-navigate',
              function (event: Event, redirectUrl: string) {
                if (redirectUrl.startsWith(data.redirect_uri)) {
                  event.preventDefault()
                  win.close()
                  const eventFromDesktop = new MessageEvent('message', {
                    data: {
                      name: `JBrowseAuthWindow-${self.internetAccountId}`,
                      redirectUri: redirectUrl,
                    },
                  })
                  // @ts-ignore
                  model.finishOAuthWindow(eventFromDesktop)
                  win.destroy()
                }
              },
            )
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
        async checkToken() {
          let token =
            preAuthInfo?.authInfo?.token ||
            (!inWebWorker
              ? sessionStorage.getItem(`${self.internetAccountId}-token`)
              : null)
          const refreshToken =
            preAuthInfo.authInfo?.refreshToken ||
            (!inWebWorker
              ? localStorage.getItem(`${self.internetAccountId}-refreshToken`)
              : null)

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
          if (!inWebWorker) {
            this.setAccessTokenInfo(accessToken.access_token, true)
            if (accessToken.refresh_token) {
              this.setRefreshToken(accessToken.refresh_token)
            }
          }
        },
        async exchangeRefreshForAccessToken() {
          const foundRefreshToken =
            preAuthInfo.authInfo.refreshToken ||
            (!inWebWorker
              ? localStorage.getItem(`${self.internetAccountId}-refreshToken`)
              : null)

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
            return accessToken
          } else {
            throw new Error(
              `Malformed or expired access token, and refresh token not found`,
            )
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
        async getFetcher(
          url: RequestInfo,
          opts?: RequestInit,
        ): Promise<Response> {
          if (!preAuthInfo || !preAuthInfo.authInfo) {
            throw new Error(
              'Authorization information not detected while trying to fetch',
            )
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
                fileUrl = await self.fetchFile(String(url), foundToken)
              } catch (e) {
                await this.handleError(e)
              }
            }
            const tokenInfoString = self.tokenType
              ? `${self.tokenType} ${preAuthInfo.authInfo.token}`
              : `${preAuthInfo.authInfo.token}`
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
        // called on the web worker, returns a generic filehandle with a modified fetch
        // preauth info should be filled in by here
        openLocation(location: UriLocation) {
          preAuthInfo =
            location.internetAccountPreAuthorization || self.generateAuthInfo
          return new RemoteFile(String(location.uri), {
            fetch: this.getFetcher,
          })
        },
        // on error it tries again once if there is a refresh token available
        async getPreAuthorizationInformation(
          location: UriLocation,
          retried = false,
        ) {
          if (!preAuthInfo.authInfo) {
            preAuthInfo = self.generateAuthInfo
          }

          // if in worker && !location.preauthInto throw new error
          if (inWebWorker && !location.internetAccountPreAuthorization) {
            throw new Error('Authorization information not detected')
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
              fileUrl = await self.fetchFile(location.uri, accessToken)
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
        async handleError(error: string, triedRefreshToken = false) {
          if (!inWebWorker) {
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
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
