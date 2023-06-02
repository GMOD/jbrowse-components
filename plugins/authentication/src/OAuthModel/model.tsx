import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import { getEnv, isElectron, UriLocation } from '@jbrowse/core/util'
import { Instance, types } from 'mobx-state-tree'

// locals
import { OAuthInternetAccountConfigModel } from './configSchema'

function fixup(buf: string) {
  return buf.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function generateChallenge(val: string) {
  const sha256 = await import('crypto-js/sha256').then(f => f.default)
  const Base64 = await import('crypto-js/enc-base64')
  return fixup(Base64.stringify(sha256(val)))
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
    .volatile(() => ({
      listener: undefined as undefined | ((event: MessageEvent) => void),
      exchangedTokenPromise: undefined as Promise<string> | undefined,
    }))
    .views(() => {
      let codeVerifier: string | undefined = undefined
      return {
        /**
         * #getter
         */
        get codeVerifierPKCE() {
          if (!codeVerifier) {
            const array = new Uint8Array(32)
            globalThis.crypto.getRandomValues(array)
            codeVerifier = fixup(Buffer.from(array).toString('base64'))
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
        const response = await fetch(self.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(
            Object.entries({
              code: token,
              grant_type: 'authorization_code' as const,
              client_id: self.clientId,
              redirect_uri: redirectUri,
              ...(self.needsPKCE
                ? { code_verifier: self.codeVerifierPKCE }
                : {}),
            }),
          ).toString(),
        })

        if (!response.ok) {
          throw new Error(
            `Failed to obtain token from endpoint: ${
              response.status
            } ${await response.text()}`,
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
        const response = await fetch(self.tokenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(
            Object.entries({
              grant_type: 'refresh_token',
              refresh_token: refreshToken,
              client_id: self.clientId,
            }),
          ).toString(),
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
    .actions(self => ({
      /**
       * #action
       */
      setExchangedTokenPromise(p?: Promise<string>) {
        self.exchangedTokenPromise = p
      },
      /**
       * #action
       * used to listen to child window for auth code/token
       */
      addMessageChannel(
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ) {
        self.listener = event => {
          // this should probably get better handling, but ignored for now
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.finishOAuthWindow(event, resolve, reject)
        }
        window.addEventListener('message', self.listener)
      },
      /**
       * #action
       */

      deleteMessageChannel() {
        if (self.listener) {
          window.removeEventListener('message', self.listener)
        }
      },
      /**
       * #action
       */
      async finishOAuthWindow(
        event: MessageEvent,
        resolve: (token: string) => void,
        reject: (error: Error) => void,
      ) {
        if (event.data.name !== `JBrowseAuthWindow-${self.internetAccountId}`) {
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
          } catch (e) {
            return reject(e instanceof Error ? e : new Error(String(e)))
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
      /**
       * #action
       * opens external OAuth flow, popup for web and new browser window for
       *  desktop
       */
      async useEndpointForAuthorization(
        resolve: (token: string) => void,
        reject: (e: Error) => void,
      ) {
        const {
          clientId: client_id,
          responseType: response_type = 'code',
          needsPKCE,
          scopes,
          hasRefreshToken,
        } = self
        const state = self.state()
        const data = {
          client_id,
          response_type,
          redirect_uri: isElectron
            ? 'http://localhost/auth'
            : window.location.origin + window.location.pathname,
          ...(state ? { state } : {}),
          ...(scopes ? { scopes } : {}),
          ...(hasRefreshToken ? { token_access_type: 'offline' } : {}),
          ...(needsPKCE
            ? {
                code_challenge: await generateChallenge(self.codeVerifierPKCE),
                code_challenge_method: 'S256',
              }
            : {}),
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
            data: {
              name: eventName,
              redirectUri,
            },
          })
          // may want to improve handling
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.finishOAuthWindow(eventFromDesktop, resolve, reject)
        } else {
          window.open(url, eventName, `width=500,height=600,left=0,top=0`)
        }
      },
      /**
       * #action
       */
      async getTokenFromUser(
        resolve: (token: string) => void,
        reject: (e: Error) => void,
      ): Promise<void> {
        const refreshToken = self.hasRefreshToken && self.retrieveRefreshToken()
        if (refreshToken) {
          try {
            const token = await self.exchangeRefreshForAccessToken(refreshToken)
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
      async validateToken(
        token: string,
        location: UriLocation,
      ): Promise<string> {
        const newInit = self.addAuthHeaderToInit({ method: 'HEAD' }, token)
        const res = await fetch(location.uri, newInit)
        if (!res.ok) {
          self.removeToken()
          const refreshToken =
            self.hasRefreshToken && self.retrieveRefreshToken()
          if (refreshToken) {
            try {
              let p = self.exchangedTokenPromise
              if (!p) {
                p = self.exchangeRefreshForAccessToken(refreshToken)
                this.setExchangedTokenPromise(p)
              }
              const newToken = await p
              this.setExchangedTokenPromise(undefined)
              return newToken
            } catch (err) {
              console.error('Token could not be refreshed', err)
              // let original error be thrown
            }
          } else {
            throw new Error(
              `Error validating token - ${res.status} ${await res.text()}`,
            )
          }
        }

        return token
      },
    }))
    .actions(self => {
      const superGetFetcher = self.getFetcher
      return {
        /**
         * #action
         * Get a fetch method that will add any needed authentication headers to
         * the request before sending it. If location is provided, it will be
         * checked to see if it includes a token in it pre-auth information.
         *
         * @param loc - UriLocation of the resource
         * @returns A function that can be used to fetch
         */
        getFetcher(loc?: UriLocation) {
          const fetcher = superGetFetcher(loc)
          return async (input: RequestInfo, init?: RequestInit) => {
            try {
              if (loc) {
                try {
                  await self.getPreAuthorizationInformation(loc)
                } catch (e) {
                  /* ignore error */
                }
              }
              const res = await fetcher(input, init)
              if (!res.ok) {
                throw new Error(`HTTP ${res.status} ${await res.text()}`)
              }
              return res
            } catch (e) {
              console.error(e)
              throw e
            }
          }
        },
      }
    })
}

export default stateModelFactory
export type OAuthStateModel = ReturnType<typeof stateModelFactory>
export type OAuthModel = Instance<OAuthStateModel>
