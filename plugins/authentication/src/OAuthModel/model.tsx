import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { isElectron, UriLocation } from '@jbrowse/core/util'
import { Instance, types } from 'mobx-state-tree'
import jwtDecode, { JwtPayload } from 'jwt-decode'

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
  state?: string
}

function fixup(buf: string) {
  return buf.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

const stateModelFactory = (configSchema: OAuthInternetAccountConfigModel) => {
  return InternetAccount.named('OAuthInternetAccount')
    .props({
      type: types.literal('OAuthInternetAccount'),
      configuration: ConfigurationReference(configSchema),
    })
    .views(() => {
      let codeVerifier: string | undefined = undefined
      return {
        get codeVerifierPKCE() {
          if (codeVerifier) {
            return codeVerifier
          }
          const array = new Uint8Array(32)
          globalThis.crypto.getRandomValues(array)
          codeVerifier = fixup(Buffer.from(array).toString('base64'))
          return codeVerifier
        },
      }
    })
    .views(self => ({
      get authEndpoint(): string {
        return getConf(self, 'authEndpoint')
      },
      get tokenEndpoint(): string {
        return getConf(self, 'tokenEndpoint')
      },
      get needsPKCE(): boolean {
        return getConf(self, 'needsPKCE')
      },
      get clientId(): string {
        return getConf(self, 'clientId')
      },
      get scopes(): string {
        return getConf(self, 'scopes')
      },
      /**
       * OAuth state parameter: https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1
       * Can override or extend if dynamic state is needed.
       */
      state(): string | undefined {
        return getConf(self, 'state') || undefined
      },
      get responseType(): 'token' | 'code' {
        return getConf(self, 'responseType')
      },
      get hasRefreshToken(): boolean {
        return getConf(self, 'hasRefreshToken')
      },
      get refreshTokenKey() {
        return `${self.internetAccountId}-refreshToken`
      },
    }))
    .actions(self => ({
      storeRefreshToken(refreshToken: string) {
        localStorage.setItem(self.refreshTokenKey, refreshToken)
      },
      removeRefreshToken() {
        localStorage.removeItem(self.refreshTokenKey)
      },
      retrieveRefreshToken() {
        return localStorage.getItem(self.refreshTokenKey)
      },
      async exchangeAuthorizationForAccessToken(
        token: string,
        redirectUri: string,
      ): Promise<string> {
        const data = {
          code: token,
          grant_type: 'authorization_code',
          client_id: self.clientId,
          code_verifier: self.codeVerifierPKCE,
          redirect_uri: redirectUri,
        }

        const params = new URLSearchParams(Object.entries(data))

        const response = await fetch(self.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        })

        if (!response.ok) {
          let errorMessage
          try {
            errorMessage = await response.text()
          } catch (error) {
            errorMessage = ''
          }
          throw new Error(
            `Failed to obtain token from endpoint: ${response.status} (${
              response.statusText
            })${errorMessage ? ` (${errorMessage})` : ''}`,
          )
        }

        const accessToken = await response.json()
        if (accessToken.refresh_token) {
          this.storeRefreshToken(accessToken.refresh_token)
        }
        return accessToken.access_token
      },
      async exchangeRefreshForAccessToken(
        refreshToken: string,
      ): Promise<string> {
        const data = {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: self.clientId,
        }

        const params = new URLSearchParams(Object.entries(data))

        const response = await fetch(self.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        })

        if (!response.ok) {
          self.removeToken()
          let text = await response.text()
          try {
            const obj = JSON.parse(text)
            if (obj.error === 'invalid_grant') {
              this.removeRefreshToken()
            }
            text = obj?.error_description ?? text
          } catch (e) {
            /* just use original text as error */
          }

          throw new Error(
            `Network response failure — ${response.status} (${
              response.statusText
            }) ${text ? ` (${text})` : ''}`,
          )
        }

        const accessToken = await response.json()
        if (accessToken.refresh_token) {
          this.storeRefreshToken(accessToken.refresh_token)
        }
        return accessToken.access_token
      },
    }))
    .actions(self => {
      let listener: (event: MessageEvent) => void
      let refreshTokenPromise: Promise<string> | undefined = undefined
      return {
        // used to listen to child window for auth code/token
        addMessageChannel(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          listener = event => {
            // this should probably get better handling, but ignored for now
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.finishOAuthWindow(event, resolve, reject)
          }
          window.addEventListener('message', listener)
        },
        deleteMessageChannel() {
          window.removeEventListener('message', listener)
        },
        async finishOAuthWindow(
          event: MessageEvent,
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          if (
            event.data.name !== `JBrowseAuthWindow-${self.internetAccountId}`
          ) {
            return this.deleteMessageChannel()
          }
          const redirectUriWithInfo = event.data.redirectUri
          const fixedQueryString = redirectUriWithInfo.replace('#', '?')
          const redirectUrl = new URL(fixedQueryString)
          const queryStringSearch = redirectUrl.search
          const urlParams = new URLSearchParams(queryStringSearch)
          if (urlParams.has('access_token')) {
            const token = urlParams.get('access_token')
            if (!token) {
              return reject(new Error('Error with token endpoint'))
            }
            self.storeToken(token)
            return resolve(token)
          }
          if (urlParams.has('code')) {
            const code = urlParams.get('code')
            if (!code) {
              return reject(new Error('Error with authorization endpoint'))
            }
            try {
              const token = await self.exchangeAuthorizationForAccessToken(
                code,
                redirectUrl.origin + redirectUrl.pathname,
              )
              self.storeToken(token)
              return resolve(token)
            } catch (error) {
              return error instanceof Error
                ? reject(error)
                : reject(new Error(String(error)))
            }
          }
          if (redirectUriWithInfo.includes('access_denied')) {
            return reject(new Error('OAuth flow was cancelled'))
          }
          if (redirectUriWithInfo.includes('error')) {
            return reject(new Error('Oauth flow error: ' + queryStringSearch))
          }
          this.deleteMessageChannel()
        },
        // opens external OAuth flow, popup for web and new browser window for desktop
        async useEndpointForAuthorization(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          const redirectUri = isElectron
            ? 'http://localhost/auth'
            : window.location.origin + window.location.pathname
          const data: OAuthData = {
            client_id: self.clientId,
            redirect_uri: redirectUri,
            response_type: self.responseType || 'code',
          }

          if (self.state()) {
            data.state = self.state()
          }

          if (self.scopes) {
            data.scope = self.scopes
          }

          if (self.needsPKCE) {
            const { codeVerifierPKCE } = self

            const sha256 = await import('crypto-js/sha256').then(f => f.default)
            const Base64 = await import('crypto-js/enc-base64')
            const codeChallenge = fixup(
              Base64.stringify(sha256(codeVerifierPKCE)),
            )
            data.code_challenge = codeChallenge
            data.code_challenge_method = 'S256'
          }

          if (self.hasRefreshToken) {
            data.token_access_type = 'offline'
          }

          const params = new URLSearchParams(Object.entries(data))

          const url = new URL(self.authEndpoint)
          url.search = params.toString()

          const eventName = `JBrowseAuthWindow-${self.internetAccountId}`
          if (isElectron) {
            const { ipcRenderer } = window.require('electron')
            const redirectUri = await ipcRenderer.invoke('openAuthWindow', {
              internetAccountId: self.internetAccountId,
              data,
              url: url.toString(),
            })

            const eventFromDesktop = new MessageEvent('message', {
              data: { name: eventName, redirectUri: redirectUri },
            })
            // may want to improve handling
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.finishOAuthWindow(eventFromDesktop, resolve, reject)
          } else {
            const options = `width=500,height=600,left=0,top=0`
            window.open(url, eventName, options)
          }
        },
        async getTokenFromUser(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ): Promise<void> {
          const refreshToken =
            self.hasRefreshToken && self.retrieveRefreshToken()
          if (refreshToken) {
            resolve(await self.exchangeRefreshForAccessToken(refreshToken))
          }
          this.addMessageChannel(resolve, reject)
          // may want to improve handling
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.useEndpointForAuthorization(resolve, reject)
        },
        async validateToken(
          token: string,
          location: UriLocation,
        ): Promise<string> {
          const decoded = jwtDecode<JwtPayload>(token)
          if (decoded.exp && decoded.exp < Date.now() / 1000) {
            const refreshToken =
              self.hasRefreshToken && self.retrieveRefreshToken()
            if (refreshToken) {
              try {
                if (!refreshTokenPromise) {
                  refreshTokenPromise =
                    self.exchangeRefreshForAccessToken(refreshToken)
                }
                const newToken = await refreshTokenPromise
                return this.validateToken(newToken, location)
              } catch (err) {
                throw new Error(`Token could not be refreshed. ${err}`)
              }
            }
          } else {
            refreshTokenPromise = undefined
          }
          return token
        },
      }
    })
}

export default stateModelFactory
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
