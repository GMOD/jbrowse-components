import {
  ConfigurationReference,
  readConfObject,
} from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import {
  isElectron,
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
  getOAuthRedirectUri,
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
    }))
    .actions(self => ({
      /**
       * #action
       * POST a grant to the token endpoint and read the access token out of the
       * answer. Both grants this account makes — trading the authorization code
       * on the way in, trading the refresh token when the access token expires
       * — are the same form-encoded request to the same endpoint answered by
       * the same body, and OAuth 2 says so (RFC 6749 §4.1.3, §6). They differ
       * in the grant's own parameters and in what a failure means, which is
       * what stays at the call sites.
       *
       * @param grant - the grant-specific parameters; `client_id` is added
       * @param describeError - turns a failed exchange into a message, and is
       * where a grant does whatever invalidating its failure implies
       */
      async postTokenGrant(
        grant: Record<string, string>,
        describeError: (response: Response) => Promise<string>,
      ) {
        const response = await fetch(self.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: self.clientId,
            ...grant,
          }).toString(),
        })
        if (!response.ok) {
          throw new Error(await describeError(response))
        }
        const data = (await response.json()) as {
          refresh_token?: string
          access_token: string
        }
        // Either grant may rotate the refresh token, and a provider that does
        // so invalidates the old one — so this is not specific to the code
        // exchange even though that is where one first arrives.
        if (data.refresh_token) {
          self.storeRefreshToken(data.refresh_token)
        }
        return data.access_token
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
          codeVerifier?: string,
        ) {
          return self.postTokenGrant(
            {
              grant_type: 'authorization_code',
              code,
              redirect_uri: redirectUri,
              ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
            },
            response =>
              getResponseError({ response, reason: 'Failed to obtain token' }),
          )
        },
        /**
         * #action
         */
        async exchangeRefreshForAccessToken(refreshToken: string) {
          const inFlight = (exchangePromise ??= self.postTokenGrant(
            { grant_type: 'refresh_token', refresh_token: refreshToken },
            async response => {
              // the access token this was going to replace is gone either way,
              // and an invalid_grant means the refresh token itself is spent
              self.removeToken()
              const { isInvalidGrant, statusText } = parseOAuthError(
                await response.text(),
              )
              if (isInvalidGrant) {
                self.removeRefreshToken()
              }
              return getResponseError({ response, statusText })
            },
          ))
          try {
            return await inFlight
          } finally {
            // only if it is still ours: every awaiter of a shared exchange runs
            // this, and a later caller can have started its own between two of
            // them — clearing unconditionally then dropped that one from the
            // slot and let the next 401 open a second refresh in parallel
            if (exchangePromise === inFlight) {
              exchangePromise = undefined
            }
          }
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       * Prove a token against the resource and, if that fails, refresh it once
       * and prove the new one. Returns whichever token worked; throws if
       * neither does. Every OAuth account validates this way and they differ
       * only in what a probe is — a HEAD of the resource here, a metadata call
       * for Dropbox and Google Drive.
       *
       * @param token - the token to prove
       * @param probe - issues a request that succeeds iff the token is good
       * @param describeError - turns a failed probe into a message
       */
      async validateTokenWithProbe(
        token: string,
        probe: (token: string) => Promise<Response>,
        describeError: (response: Response, reason?: string) => Promise<string>,
      ) {
        const response = await probe(token)
        if (response.ok) {
          return token
        }
        // Every path out of here leaves this token unusable, so drop it before
        // taking any of them — that is what lets the next getToken re-prompt.
        // Without it an account with no refresh token to fall back on (Google
        // Drive's implicit flow issues none, and its access tokens last an
        // hour) kept handing the expired token back out of getToken's cached
        // promise: every later request threw this same error, and nothing
        // short of a page reload ever asked the user to log in again.
        self.removeToken()
        const refreshToken = self.retrieveRefreshToken()
        if (!refreshToken) {
          throw new Error(
            await describeError(response, 'Error validating token'),
          )
        }
        // Exactly once. Recursing here instead looped forever on a resource
        // that fails for a reason no new token fixes — a file the account
        // cannot see — refreshing against the token endpoint on every pass.
        const newToken = await self.exchangeRefreshForAccessToken(refreshToken)
        const retry = await probe(newToken)
        if (!retry.ok) {
          throw new Error(await describeError(retry, 'Error validating token'))
        }
        // removeToken above dropped the cached promise, so storing is enough
        self.storeToken(newToken)
        return newToken
      },
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
        // RFC 7636 §4.1 wants one verifier per authorization request, and this
        // is the request — so it lives here rather than on the model, where a
        // single lazily-created one was shared by every flow the account ever
        // ran. `state` immediately above was already rotating for the same
        // reason.
        const codeVerifier = self.needsPKCE
          ? toBase64Url(randomBytes(32))
          : undefined
        const codeChallenge = codeVerifier
          ? await sha256Base64Url(codeVerifier)
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
            self.exchangeAuthorizationForAccessToken(code, uri, codeVerifier),
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
          return waitForOAuthMessage(
            event => finishOAuthWindow(event, oauthParams),
            {
              popup,
              isOwnMessage: event =>
                getOAuthRedirectUri(event, self.internetAccountId) !==
                undefined,
            },
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
        return self.validateTokenWithProbe(
          token,
          probeToken =>
            fetch(
              location.uri,
              self.addAuthHeaderToInit({ method: 'HEAD' }, probeToken),
            ),
          (response, reason) => getResponseError({ response, reason }),
        )
      },
    }))
}

export default stateModelFactory
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
