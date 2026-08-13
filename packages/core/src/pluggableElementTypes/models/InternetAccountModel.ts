import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationReference, getConf } from '../../configuration/index.ts'
import { RemoteFileWithRangeCache } from '../../util/io/index.ts'
import { isWebWorker } from '../../util/isWebWorker.ts'
import {
  sessionStorageGetItem,
  sessionStorageRemoveItem,
  sessionStorageSetItem,
} from '../../util/sessionStorage.ts'
import { ElementId } from '../../util/types/mst.ts'
import { BaseInternetAccountConfig } from './baseInternetAccountConfig.ts'
import { uriMatchesDomains } from './uriMatchesDomains.ts'

import type {
  AnyReactComponentType,
  UriLocation,
} from '../../util/types/index.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type React from 'react'

/**
 * #stateModel BaseInternetAccountModel
 * #category internetAccount
 */

export const InternetAccount = types
  .model('InternetAccount', {
    /**
     * #property
     */
    id: ElementId,
    /**
     * #property
     */
    type: types.string,
    /**
     * #property
     */
    configuration: ConfigurationReference(BaseInternetAccountConfig),
  })
  .views(self => ({
    /**
     * #getter
     */
    get name(): string {
      return getConf(self, 'name')
    },
    /**
     * #getter
     */
    get description(): string {
      return getConf(self, 'description')
    },
    /**
     * #getter
     */
    get internetAccountId(): string {
      return getConf(self, 'internetAccountId') // NOTE: this is the explicitIdentifier of the config schema
    },
    /**
     * #getter
     */
    get authHeader(): string {
      return getConf(self, 'authHeader')
    },
    /**
     * #getter
     */
    get tokenType(): string {
      return getConf(self, 'tokenType')
    },
    /**
     * #getter
     */
    get domains(): string[] {
      return getConf(self, 'domains')
    },
    /**
     * #getter
     * Can use this to customize what is displayed in fileSelector's toggle box
     */
    get toggleContents(): React.ReactNode {
      return null
    },
    /**
     * #getter
     * Can use this to customize what the fileSelector. It takes a prop called
     * `setLocation` that should be used to set a UriLocation
     */
    get SelectorComponent(): AnyReactComponentType | undefined {
      return undefined
    },
    /**
     * #getter
     * Can use this to add a label to the UrlChooser. Has no effect if a custom
     * SelectorComponent is supplied
     */
    get selectorLabel(): string | undefined {
      return undefined
    },
    /**
     * #getter
     * Whether the fileSelector offers this account as a source to pick. Turn it
     * off for an account that only ever matches by domain and has nothing of
     * its own to enter — HTTP Basic, whose ephemeral per-origin accounts would
     * otherwise pile up as toggles nobody asked for.
     */
    get showInFileSelector(): boolean {
      return true
    },
  }))
  .views(self => ({
    /**
     * #method
     * Determine whether this internetAccount provides credentials for a URL
     * @param location  - UriLocation of resource
     * @returns true or false
     */
    handlesLocation(location: UriLocation) {
      return uriMatchesDomains(location.uri, self.domains)
    },
    /**
     * #getter
     * The key used to store this internetAccount's token in sessionStorage
     */
    get tokenKey() {
      return `${self.internetAccountId}-token`
    },
  }))
  .actions(self => ({
    /**
     * #action
     * Must be implemented by a model extending or composing this one. Pass the
     * user's token to `resolve`.
     * @param resolve - Pass the token to this function
     * @param reject - If there is an error getting the token, call this function
     */
    getTokenFromUser(
      _resolve: (token: string) => void,
      _reject: (error: Error) => void,
    ): void {
      throw new Error('getTokenFromUser must be implemented by extending model')
    },
    /**
     * #action
     */
    // Through the guarded helpers rather than `sessionStorage` directly: in the
    // embedded products this runs on someone else's page, where reading the
    // global at all throws if third-party storage is blocked. A token that
    // cannot be cached costs one more auth prompt per tab; a throw here takes
    // the auth flow down with it.
    storeToken(token: string) {
      sessionStorageSetItem(self.tokenKey, token)
    },
    /**
     * #action
     */
    retrieveToken() {
      return sessionStorageGetItem(self.tokenKey)
    },
    /**
     * #action
     * This can be used by an internetAccount to validate a token works before
     * it is used. This is run when preAuthorizationInformation is requested,
     * so it can be used to check that a token is valid before sending it to a
     * worker thread. It expects the token to be returned so that this action
     * can also be used to generate a new token (e.g. by using a refresh token)
     * if the original one was invalid. Should throw an error if a token is
     * invalid.
     *
     * @param token - Auth token
     * @param loc - UriLocation of the resource
     * @returns - Valid auth token
     */
    async validateToken(token: string, _loc: UriLocation) {
      return token
    },
  }))
  .actions(self => {
    let tokenPromise: Promise<string> | undefined = undefined
    function clearToken() {
      sessionStorageRemoveItem(self.tokenKey)
      tokenPromise = undefined
    }
    return {
      /**
       * #action
       * Clears the stored token. Also drops the in-memory cached promise so a
       * subsequent `getToken` re-prompts / re-derives rather than handing back
       * the token that was just invalidated.
       */
      removeToken() {
        clearToken()
      },
      /**
       * #action
       * Try to get the token from the location pre-auth, from local storage,
       * or from a previously cached promise. If token is not available, uses
       * `getTokenFromUser`.
       *
       * @param location - UriLocation of the resource
       * @returns A promise for the token
       */
      async getToken(location?: UriLocation): Promise<string> {
        if (tokenPromise) {
          return tokenPromise
        }
        let token = location?.internetAccountPreAuthorization?.authInfo?.token
        if (token) {
          tokenPromise = Promise.resolve(token)
          return tokenPromise
        }
        // `isWebWorker()`, not a `typeof sessionStorage` probe: that asks a
        // different question (it is also false on a page where storage is
        // blocked, which is a main thread that CAN prompt) and it throws
        // outright in exactly that case, at module load.
        if (isWebWorker()) {
          throw new Error(
            'Did not get internet account pre-authorization info in worker',
          )
        }
        token = self.retrieveToken()
        if (token) {
          tokenPromise = Promise.resolve(token)
          return tokenPromise
        }
        // The catch, rather than a clearToken() in the reject callback: a
        // getTokenFromUser that throws on the way *in* — the token-entry
        // accounts reach for `root.session` to queue their dialog, and an
        // embedded root need not have one — never calls either callback, and
        // the rejected promise it leaves behind would then be handed to every
        // request for the rest of the session. Failing to get a token must
        // never be a state the account stays in.
        tokenPromise = new Promise<string>((resolve, reject) => {
          self.getTokenFromUser(token => {
            self.storeToken(token)
            resolve(token)
          }, reject)
        }).catch((error: unknown) => {
          clearToken()
          throw error
        })
        return tokenPromise
      },
    }
  })
  .actions(self => ({
    /**
     * #action
     */
    addAuthHeaderToInit(init?: RequestInit, token?: string) {
      // build from init.headers via the Headers constructor so all HeadersInit
      // shapes are preserved — object-spreading a Headers *instance* yields
      // nothing (no enumerable own props), silently dropping caller headers
      const headers = new Headers(init?.headers)
      if (token) {
        headers.set(
          self.authHeader,
          self.tokenType ? `${self.tokenType} ${token}` : token,
        )
      }
      return { ...init, headers }
    },
    /**
     * #action
     * Run a request with the current token and, only if it comes back 401, put
     * the token through `validateToken` and run it exactly once more. This is
     * how every account's fetcher reaches a resource.
     *
     * @param loc - UriLocation of the resource
     * @param run - issues the request with a given token
     */
    async fetchWithToken(
      loc: UriLocation | undefined,
      run: (token: string) => Promise<Response>,
    ) {
      // Deliberately not a validateToken pre-flight on every request — a HEAD
      // here, a metadata call for Dropbox and Google Drive — to re-prove a
      // token that had just worked. A range-read track issues hundreds of
      // requests, so that doubled both the round trips and the provider quota
      // each track spent.
      const token = await self.getToken(loc)
      const response = await run(token)
      if (response.status !== 401 || !loc) {
        return response
      }
      // A worker has neither storage nor a user to prompt, so it cannot mint a
      // token — only the main thread can, and it re-validates before shipping
      // the next pre-authorization. Going on into validateToken here died on
      // `ReferenceError: sessionStorage is not defined` partway through a
      // refresh; hand back the 401 so the caller reports it.
      if (isWebWorker()) {
        return response
      }
      // validateToken renews an expired token, or throws if it can't. An
      // account with nothing to renew it with — no refresh token, or
      // `validateWithHEAD` off — hands the same one straight back, and
      // re-running the request with a token that just failed only buys a
      // second identical 401.
      const validated = await self.validateToken(token, loc)
      return validated === token ? response : run(validated)
    },
    /**
     * #action
     * Gets the token and returns it along with the information needed to
     * create a new internetAccount.
     *
     * @param location - UriLocation of the resource
     * @returns
     */
    async getPreAuthorizationInformation(location: UriLocation) {
      const authToken = await self.getToken(location)
      try {
        return {
          internetAccountType: self.type,
          authInfo: {
            token: await self.validateToken(authToken, location),
            configuration: getConf(self),
          },
        }
      } catch (error) {
        self.removeToken()
        throw error
      }
    },
  }))
  .actions(self => ({
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
      return (input: RequestInfo, init?: RequestInit) =>
        self.fetchWithToken(loc, token =>
          fetch(input, self.addAuthHeaderToInit(init, token)),
        )
    },
  }))
  .actions(self => ({
    /**
     * #action
     * Gets a filehandle that uses a fetch that adds auth headers
     * @param location - UriLocation of the resource
     * @returns A filehandle
     */
    openLocation(location: UriLocation) {
      return new RemoteFileWithRangeCache(location.uri, {
        fetch: self.getFetcher(location),
      })
    },
  }))

export type BaseInternetAccountStateModel = typeof InternetAccount
export type BaseInternetAccountModel = Instance<BaseInternetAccountStateModel>
