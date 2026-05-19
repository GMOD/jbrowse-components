import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { isElectron, sha256Base64Url, toBase64Url } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import { getResponseError } from '../util.ts'

import type { OAuthInternetAccountConfigModel } from './configSchema.ts'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

function parseOAuthError(text: string) {
  try {
    const { error, error_description } = JSON.parse(text) as {
      error?: string
      error_description?: string
    }
    return {
      isInvalidGrant: error === 'invalid_grant',
      statusText: error_description ?? text,
    }
  } catch {
    return { isInvalidGrant: false, statusText: text }
  }
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
      // Closure variable rather than MST state so it survives model re-renders
      // without being serialized to the snapshot.
      let codeVerifier: string | undefined = undefined
      return {
        /**
         * #getter
         */
        get codeVerifierPKCE() {
          if (!codeVerifier) {
            const array = new Uint8Array(32)
            globalThis.crypto.getRandomValues(array)
            codeVerifier = toBase64Url(array)
          }
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
        return getConf(self, 'state')
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
        code: string,
        redirectUri: string,
      ) {
        const params = new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          client_id: self.clientId,
          redirect_uri: redirectUri,
          ...(self.needsPKCE ? { code_verifier: self.codeVerifierPKCE } : {}),
        })

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

        const data = (await response.json()) as {
          refresh_token?: string
          access_token: string
        }
        if (data.refresh_token) {
          this.storeRefreshToken(data.refresh_token)
        }
        return data.access_token
      },
      /**
       * #action
       */
      async exchangeRefreshForAccessToken(refreshToken: string) {
        const response = await fetch(self.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: self.clientId,
          }).toString(),
        })

        if (!response.ok) {
          self.removeToken()
          const { isInvalidGrant, statusText } = parseOAuthError(
            await response.text(),
          )
          if (isInvalidGrant) {
            this.removeRefreshToken()
          }
          throw new Error(await getResponseError({ response, statusText }))
        }
        const data = (await response.json()) as {
          refresh_token?: string
          access_token: string
        }
        if (data.refresh_token) {
          this.storeRefreshToken(data.refresh_token)
        }
        return data.access_token
      },
    }))
    .actions(self => {
      let listener: (event: MessageEvent) => void
      // Shared across concurrent validateToken calls so parallel 401s all wait
      // on the same refresh request rather than each triggering a separate one.
      let exchangedTokenPromise: Promise<string> | undefined
      return {
        /**
         * #action
         * used to listen to child window for auth code/token
         */
        addMessageChannel(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          listener = async event => {
            try {
              const token = await this.finishOAuthWindow(event)
              if (token !== undefined) {
                resolve(token)
              }
            } catch (e: unknown) {
              reject(e instanceof Error ? e : new Error(String(e)))
            }
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
         * Returns the token if the event completes the flow, undefined if the
         * event name doesn't match. Throws on any OAuth error.
         */
        async finishOAuthWindow(event: MessageEvent) {
          if (
            event.data.name !== `JBrowseAuthWindow-${self.internetAccountId}`
          ) {
            return undefined
          }
          // Remove listener before any branching so it fires exactly once.
          this.deleteMessageChannel()
          const redirectUrl = new URL(event.data.redirectUri.replace('#', '?'))
          const urlParams = new URLSearchParams(redirectUrl.search)
          const expectedState = self.state()
          if (expectedState && urlParams.get('state') !== expectedState) {
            throw new Error('OAuth state mismatch — possible CSRF attack')
          }
          const accessToken = urlParams.get('access_token')
          if (accessToken) {
            self.storeToken(accessToken)
            return accessToken
          }
          const code = urlParams.get('code')
          if (code) {
            const token = await self.exchangeAuthorizationForAccessToken(
              code,
              redirectUrl.origin + redirectUrl.pathname,
            )
            self.storeToken(token)
            return token
          }
          const error = urlParams.get('error')
          if (error === 'access_denied') {
            throw new Error('OAuth flow was cancelled')
          }
          if (error) {
            throw new Error(`OAuth flow error: ${error}`)
          }
          return undefined
        },
        /**
         * #action
         * opens external OAuth flow, popup for web and new browser window for
         * desktop
         */
        async useEndpointForAuthorization(resolve: (token: string) => void) {
          const redirectUri = isElectron
            ? 'http://localhost/auth'
            : window.location.origin + window.location.pathname
          const state = self.state()
          const codeChallenge = self.needsPKCE
            ? await sha256Base64Url(self.codeVerifierPKCE)
            : undefined
          const data: Record<string, string> = {
            client_id: self.clientId,
            redirect_uri: redirectUri,
            response_type: self.responseType,
            token_access_type: 'offline',
            ...(state ? { state } : {}),
            ...(self.scopes ? { scope: self.scopes } : {}),
            ...(codeChallenge
              ? { code_challenge: codeChallenge, code_challenge_method: 'S256' }
              : {}),
          }

          const params = new URLSearchParams(data)

          const url = new URL(self.authEndpoint)
          url.search = params.toString()

          const eventName = `JBrowseAuthWindow-${self.internetAccountId}`
          if (isElectron) {
            // @ts-ignore - electron injects require onto window, has to be ignore for now
            const { ipcRenderer } = window.require('electron')
            const redirectUri = await ipcRenderer.invoke('openAuthWindow', {
              internetAccountId: self.internetAccountId,
              data,
              url: url.toString(),
            })

            const eventFromDesktop = new MessageEvent('message', {
              data: { name: eventName, redirectUri },
            })
            const token = await this.finishOAuthWindow(eventFromDesktop)
            if (token !== undefined) {
              resolve(token)
            }
          } else {
            window.open(url, eventName, 'width=500,height=600,left=0,top=0')
          }
        },
        /**
         * #action
         */
        async getTokenFromUser(
          resolve: (token: string) => void,
          reject: (error: Error) => void,
        ) {
          const refreshToken = self.retrieveRefreshToken()
          let refreshSucceeded = false
          if (refreshToken) {
            try {
              resolve(await self.exchangeRefreshForAccessToken(refreshToken))
              refreshSucceeded = true
            } catch (e) {
              console.error(e)
              self.removeRefreshToken()
            }
          }
          if (!refreshSucceeded) {
            this.addMessageChannel(resolve, reject)
            try {
              await this.useEndpointForAuthorization(resolve)
            } catch (e: unknown) {
              reject(e instanceof Error ? e : new Error(String(e)))
            }
          }
        },
        /**
         * #action
         */
        async validateToken(token: string, location: UriLocation) {
          const newInit = self.addAuthHeaderToInit({ method: 'HEAD' }, token)
          const response = await fetch(location.uri, newInit)
          if (!response.ok) {
            self.removeToken()
            const refreshToken = self.retrieveRefreshToken()
            if (refreshToken) {
              try {
                exchangedTokenPromise ??=
                  self.exchangeRefreshForAccessToken(refreshToken)
                return await exchangedTokenPromise
              } catch (err) {
                console.error('Token could not be refreshed', err)
                // let original error be thrown
              } finally {
                exchangedTokenPromise = undefined
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
    .actions(self => ({
      /**
       * #action
       */
      getFetcher(loc?: UriLocation) {
        return async (input: RequestInfo, init?: RequestInit) => {
          const token = loc
            ? await self.validateToken(await self.getToken(loc), loc)
            : await self.getToken()
          return fetch(input, self.addAuthHeaderToInit(init, token))
        }
      },
    }))
}

export default stateModelFactory
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
