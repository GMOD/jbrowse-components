import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import {
  isElectron,
  isWebWorker,
  localStorageGetItem,
  localStorageRemoveItem,
  localStorageSetItem,
  sha256Base64Url,
  toBase64Url,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

import { getResponseError } from '../util.ts'
import {
  finishOAuthRedirect,
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

function randomBytes(length: number) {
  return globalThis.crypto.getRandomValues(new Uint8Array(length))
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
          codeVerifier ??= toBase64Url(randomBytes(32))
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
      /**
       * #getter
       * Extra parameters to add to the authorization request. Empty here;
       * a provider that needs one of its own overrides this.
       */
      get authFlowParams(): Record<string, string> {
        return {}
      },
    }))

    .actions(self => ({
      /**
       * #action
       */
      // through the guarded helpers rather than `localStorage` directly: this
      // runs on someone else's page in the embedded products, where reading the
      // global at all throws if third-party storage is blocked. A refresh token
      // that cannot be cached only costs an extra auth prompt; a throw here
      // takes down the whole auth flow.
      storeRefreshToken(refreshToken: string) {
        localStorageSetItem(self.refreshTokenKey, refreshToken)
      },
      /**
       * #action
       */
      removeRefreshToken() {
        localStorageRemoveItem(self.refreshTokenKey)
      },
      /**
       * #method
       */
      retrieveRefreshToken() {
        return localStorageGetItem(self.refreshTokenKey)
      },
      /**
       * #action
       * Swap in an access token obtained from a refresh, in place of the one it
       * replaces.
       */
      replaceToken(token: string) {
        // storeToken alone writes sessionStorage but cannot reach getToken's
        // in-memory promise (a closure declared after it), so on its own it
        // leaves the invalidated token cached and every later request pays the
        // same refresh again. removeToken is what drops that promise.
        self.removeToken()
        self.storeToken(token)
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
        // the slot defaults to '', and `new URL('')` reports only
        // "TypeError: Invalid URL:" — say which account is unconfigured
        if (!self.authEndpoint) {
          throw new Error(
            `Internet account ${self.internetAccountId} has no authEndpoint configured`,
          )
        }
        const redirectUri = isElectron
          ? 'http://localhost/auth'
          : window.location.origin + window.location.pathname
        // RFC 6749 §10.12: without a state there is nothing tying the redirect
        // back to the request this window started, so a page that can post to
        // us can hand us its own authorization. A configured state is a
        // constant and so guessable — generate a per-flow nonce unless one was
        // set explicitly. Providers are required to echo it back.
        const state = self.state || toBase64Url(randomBytes(16))
        const codeChallenge = self.needsPKCE
          ? await sha256Base64Url(self.codeVerifierPKCE)
          : undefined
        const data: Record<string, string> = {
          client_id: self.clientId,
          redirect_uri: redirectUri,
          response_type: self.responseType,
          state,
          ...self.authFlowParams,
          ...(self.scopes ? { scope: self.scopes } : {}),
          ...(codeChallenge
            ? { code_challenge: codeChallenge, code_challenge_method: 'S256' }
            : {}),
        }

        const url = new URL(self.authEndpoint)
        url.search = new URLSearchParams(data).toString()
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
          // the main process resolves undefined when the user closes the auth
          // window without completing the flow
          if (electronRedirectUri === undefined) {
            throw new Error('OAuth flow was cancelled')
          }
          const token = await finishOAuthRedirect(
            electronRedirectUri,
            oauthParams,
          )
          if (token === undefined) {
            throw new Error('Electron OAuth flow returned no token')
          }
          return token
        } else {
          const popup = window.open(
            url,
            `JBrowseAuthWindow-${self.internetAccountId}`,
            'width=500,height=600,left=0,top=0',
          )
          // A blocked popup used to leave the returned promise pending forever,
          // and `getToken` caches that promise — so the account stayed wedged
          // for the rest of the session with nothing shown to the user
          if (!popup) {
            throw new Error(
              `Could not open the ${self.internetAccountId} login window. Allow popups for this site and try again.`,
            )
          }
          // no await between the open above and the listener below, so the
          // redirect message cannot be delivered before we are listening
          return waitForOAuthMessage(event =>
            finishOAuthWindow(event, oauthParams),
          )
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
              const newToken =
                await self.exchangeRefreshForAccessToken(refreshToken)
              // removeToken above already dropped the cached one
              self.storeToken(newToken)
              return newToken
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
       * Run a request with the current token and, only if it comes back 401,
       * refresh the token through `validateToken` and run it exactly once more.
       * This is how the fetchers reach a resource.
       */
      async fetchWithToken(
        loc: UriLocation | undefined,
        run: (token: string) => Promise<Response>,
      ) {
        // Deliberately not getValidatedToken, which pre-flights validateToken —
        // a HEAD here, a metadata call for Dropbox and Google Drive — ahead of
        // *every* request, to re-prove a token that had just worked. A
        // range-read track issues hundreds of requests, so that doubled both
        // the round trips and the provider quota each track spent.
        const token = await self.getToken(loc)
        const response = await run(token)
        if (response.status !== 401 || !loc) {
          return response
        }
        // A worker has neither storage nor a user to prompt, so it cannot mint
        // a token — only the main thread can, and it re-validates before
        // shipping the next pre-authorization. Going on into validateToken here
        // died on `ReferenceError: sessionStorage is not defined` partway
        // through a refresh; hand back the 401 so the caller reports it.
        if (isWebWorker()) {
          return response
        }
        // validateToken refreshes the expired token, or throws if it can't
        return run(await self.validateToken(token, loc))
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      getFetcher(loc?: UriLocation) {
        return (input: RequestInfo, init?: RequestInit) =>
          self.fetchWithToken(loc, token =>
            fetch(input, self.addAuthHeaderToInit(init, token)),
          )
      },
    }))
}

export default stateModelFactory
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
