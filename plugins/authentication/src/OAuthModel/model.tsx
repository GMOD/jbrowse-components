import { ConfigurationReference, readConfObject } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { isElectron, sha256Base64Url, toBase64Url } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import { getResponseError } from '../util.ts'
import {
  finishOAuthWindow,
  parseOAuthError,
  waitForOAuthMessage,
} from './util.ts'

import type {
  OAuthInternetAccountConfig,
  OAuthInternetAccountConfigModel,
} from './configSchema.ts'
import type { OAuthWindowParams } from './util.ts'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
    .views(self => ({
      /**
       * #getter
       * The config typed off the concrete schema. `ConfigurationReference`
       * erases `self.configuration` to `any` (the reference's MST instance brand
       * doesn't carry the schema's slot definitions), so reads go through this
       * getter to recover per-slot types and slot-name validation.
       */
      get conf(): OAuthInternetAccountConfig {
        return self.configuration
      },
    }))
    .views(() => {
      // Closure variable rather than MST state so it survives model re-renders
      // without being serialized to the snapshot.
      let codeVerifier: string | undefined
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
      get authEndpoint() {
        return readConfObject(self.conf, 'authEndpoint')
      },
      /**
       * #getter
       */
      get tokenEndpoint() {
        return readConfObject(self.conf, 'tokenEndpoint')
      },
      /**
       * #getter
       */
      get needsPKCE() {
        return readConfObject(self.conf, 'needsPKCE')
      },
      /**
       * #getter
       */
      get clientId() {
        return readConfObject(self.conf, 'clientId')
      },
      /**
       * #getter
       */
      get scopes() {
        return readConfObject(self.conf, 'scopes')
      },
      /**
       * #getter
       * OAuth state parameter:
       * https://www.rfc-editor.org/rfc/rfc6749#section-4.1.1
       *
       * Can override or extend if dynamic state is needed.
       */
      get state() {
        return readConfObject(self.conf, 'state')
      },
      /**
       * #getter
       */
      get responseType() {
        return readConfObject(self.conf, 'responseType') as 'token' | 'code'
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
    }))
    .actions(self => {
      // Shared across concurrent exchangeRefreshForAccessToken calls so parallel
      // 401s all wait on the same refresh request rather than each triggering a
      // separate one.
      let exchangePromise: Promise<string> | undefined
      return {
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
            self.storeRefreshToken(data.refresh_token)
          }
          return data.access_token
        },
        /**
         * #action
         */
        async exchangeRefreshForAccessToken(refreshToken: string) {
          exchangePromise ??= (async () => {
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
                self.removeRefreshToken()
              }
              throw new Error(await getResponseError({ response, statusText }))
            }
            const data = (await response.json()) as {
              refresh_token?: string
              access_token: string
            }
            if (data.refresh_token) {
              self.storeRefreshToken(data.refresh_token)
            }
            return data.access_token
          })()
          try {
            return await exchangePromise
          } finally {
            exchangePromise = undefined
          }
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * Opens the provider's auth page and returns a promise for the resulting
       * token. For Electron, drives the flow directly via IPC; for web, opens a
       * popup and waits for the redirect message.
       */
      async getTokenViaAuthFlow(): Promise<string> {
        const redirectUri = isElectron
          ? 'http://localhost/auth'
          : window.location.origin + window.location.pathname
        const state = self.state
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

        const url = new URL(self.authEndpoint)
        url.search = new URLSearchParams(data).toString()
        const eventName = `JBrowseAuthWindow-${self.internetAccountId}`
        const oauthParams: OAuthWindowParams = {
          internetAccountId: self.internetAccountId,
          expectedState: state,
          exchangeAuthorizationCode: async (code, uri) =>
            self.exchangeAuthorizationForAccessToken(code, uri),
          storeToken: token => {
            self.storeToken(token)
          },
        }

        if (isElectron) {
          // @ts-ignore - electron injects require onto window
          const { ipcRenderer } = window.require('electron')
          const electronRedirectUri = await ipcRenderer.invoke(
            'openAuthWindow',
            {
              internetAccountId: self.internetAccountId,
              data,
              url: url.toString(),
            },
          )
          const event = new MessageEvent('message', {
            data: { name: eventName, redirectUri: electronRedirectUri },
          })
          const token = await finishOAuthWindow(event, oauthParams)
          if (token === undefined) {
            throw new Error('Electron OAuth flow returned no token')
          }
          return token
        } else {
          const tokenPromise = waitForOAuthMessage(event =>
            finishOAuthWindow(event, oauthParams),
          )
          window.open(url, eventName, 'width=500,height=600,left=0,top=0')
          return tokenPromise
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      async getTokenFromUser(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ) {
        try {
          const refreshToken = self.retrieveRefreshToken()
          let token: string | undefined
          if (refreshToken) {
            try {
              token = await self.exchangeRefreshForAccessToken(refreshToken)
            } catch (e) {
              console.error(e)
            }
          }
          resolve(
            token !== undefined ? token : await self.getTokenViaAuthFlow(),
          )
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)))
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
              return await self.exchangeRefreshForAccessToken(refreshToken)
            } catch (err) {
              console.error('Token could not be refreshed', err)
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
    }))
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
