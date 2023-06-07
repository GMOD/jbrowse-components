import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { isElectron, UriLocation } from '@jbrowse/core/util'
import { Instance, types } from 'mobx-state-tree'

// locals
import { OAuthInternetAccountConfigModel } from './configSchema'
import { fixup, generateChallenge } from './util'
import { getResponseError } from '../util'

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

interface OAuthExchangeData {
  code: string
  grant_type: string
  client_id: string
  redirect_uri: string
  code_verifier?: string
}

/**
 * #stateModel OAuthInternetAccount
 */
const stateModelFactory = (configSchema: OAuthInternetAccountConfigModel) => {
  return InternetAccount.named('OAuthInternetAccount')
    .props({
      /**
       * #property
       */
      type: types.literal('OAuthInternetAccount'),
      /**
       * #property
       */
      configuration: ConfigurationReference(configSchema),
    })
    .views(() => {
      let codeVerifier: string | undefined = undefined
      return {
        /**
         * #getter
         */
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
      /**
       * #getter
       */
      get authEndpoint(): string {
        return getConf(self, 'authEndpoint')
      },
      /**
       * #getter
       */
      get tokenEndpoint(): string {
        return getConf(self, 'tokenEndpoint')
      },
      /**
       * #getter
       */
      get needsPKCE(): boolean {
        return getConf(self, 'needsPKCE')
      },
      /**
       * #getter
       */
      get clientId(): string {
        return getConf(self, 'clientId')
      },
      /**
       * #getter
       */
      get scopes(): string {
        return getConf(self, 'scopes')
      },
      /**
       * #method
       * OAuth state parameter:
       * https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1
       *
       * Can override or extend if dynamic state is needed.
       */
      state(): string | undefined {
        return getConf(self, 'state') || undefined
      },
      /**
       * #getter
       */
      get responseType(): 'token' | 'code' {
        return getConf(self, 'responseType')
      },
      /**
       * #getter
       */
      get hasRefreshToken(): boolean {
        return getConf(self, 'hasRefreshToken')
      },
      /**
       * #getter
       */
      get refreshTokenKey() {
        return `${self.internetAccountId}-refreshToken`
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      storeRefreshToken(refreshToken: string) {
        localStorage.setItem(self.refreshTokenKey, refreshToken)
      },
      /**
       * #action
       */
      removeRefreshToken() {
        localStorage.removeItem(self.refreshTokenKey)
      },
      /**
       * #method
       */
      retrieveRefreshToken() {
        return localStorage.getItem(self.refreshTokenKey)
      },
      /**
       * #action
       */
      async exchangeAuthorizationForAccessToken(
        token: string,
        redirectUri: string,
      ): Promise<string> {
        const data: OAuthExchangeData = {
          code: token,
          grant_type: 'authorization_code',
          client_id: self.clientId,
          redirect_uri: redirectUri,
        }
        if (self.needsPKCE) {
          data.code_verifier = self.codeVerifierPKCE
        }

        const params = new URLSearchParams(Object.entries(data))

        const response = await fetch(self.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString(),
        })

        if (!response.ok) {
          throw new Error(
            await getResponseError({
              response,
              reason: 'Failed to obtain token',
            }),
          )
        }

        const accessToken = await response.json()
        if (accessToken.refresh_token) {
          this.storeRefreshToken(accessToken.refresh_token)
        }
        return accessToken.access_token
      },
      /**
       * #action
       */
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
            await getResponseError({ response, statusText: text }),
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
      let listener: (event: MessageEvent) => void | undefined
      let exchangedTokenPromise: Promise<string> | undefined = undefined
      return {
        /**
         * #action
         * used to listen to child window for auth code/token
         */
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
        /**
         * #action
         */
        deleteMessageChannel() {
          window.removeEventListener('message', listener)
        },
        /**
         * #action
         */
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
            return reject(new Error('OAuth flow error: ' + queryStringSearch))
          }
          this.deleteMessageChannel()
        },
        /**
         * #action
         * opens external OAuth flow, popup for web and new browser window for
         * desktop
         */
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
            data.code_challenge = await generateChallenge(self.codeVerifierPKCE)
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
        /**
         * #action
         */
        async getTokenFromUser(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          const refreshToken =
            self.hasRefreshToken && self.retrieveRefreshToken()
          if (refreshToken) {
            try {
              const token = await self.exchangeRefreshForAccessToken(
                refreshToken,
              )
              resolve(token)
            } catch (err) {
              self.removeRefreshToken()
            }
          }
          this.addMessageChannel(resolve, reject)
          // may want to improve handling
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.useEndpointForAuthorization(resolve, reject)
        },
        /**
         * #action
         */
        async validateToken(token: string, location: UriLocation) {
          const newInit = self.addAuthHeaderToInit({ method: 'HEAD' }, token)
          const response = await fetch(location.uri, newInit)
          if (!response.ok) {
            self.removeToken()
            const refreshToken =
              self.hasRefreshToken && self.retrieveRefreshToken()
            if (refreshToken) {
              try {
                if (!exchangedTokenPromise) {
                  exchangedTokenPromise =
                    self.exchangeRefreshForAccessToken(refreshToken)
                }
                const newToken = await exchangedTokenPromise
                exchangedTokenPromise = undefined
                return newToken
              } catch (err) {
                console.error('Token could not be refreshed', err)
                // let original error be thrown
              }
            }

            throw new Error(
              await getResponseError({
                response,
                reason: 'Error validating token',
              }),
            )
          }
          return token
        },
      }
    })
    .actions(self => {
      const superGetFetcher = self.getFetcher
      return {
        /**
         * #action
         * Get a fetch method that will add any needed authentication headers to
         * the request before sending it. If location is provided, it will be
         * checked to see if it includes a token in it's pre-auth information.
         *
         * @param loc - UriLocation of the resource
         * @returns A function that can be used to fetch
         */
        getFetcher(loc?: UriLocation) {
          const fetcher = superGetFetcher(loc)
          return async (input: RequestInfo, init?: RequestInit) => {
            if (loc) {
              try {
                await self.getPreAuthorizationInformation(loc)
              } catch (e) {
                /* ignore error */
              }
            }
            const response = await fetcher(input, init)
            if (!response.ok) {
              throw new Error(await getResponseError({ response }))
            }
            return response
          }
        },
      }
    })
}

export default stateModelFactory
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
