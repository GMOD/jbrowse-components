import React from 'react'
import { Instance, types } from 'mobx-state-tree'
import { getConf } from '../../configuration'
import { RemoteFileWithRangeCache } from '../../util/io'
import { ElementId } from '../../util/types/mst'
import { UriLocation, AnyReactComponentType } from '../../util/types'

const inWebWorker = typeof sessionStorage === 'undefined'

export const InternetAccount = types
  .model('InternetAccount', {
    id: ElementId,
    type: types.string,
  })
  .views(self => ({
    get name(): string {
      return getConf(self, 'name')
    },
    get description(): string {
      return getConf(self, 'description')
    },
    get internetAccountId(): string {
      return getConf(self, 'internetAccountId')
    },
    get authHeader(): string {
      return getConf(self, 'authHeader')
    },
    get tokenType(): string {
      return getConf(self, 'tokenType')
    },
    get domains(): string[] {
      return getConf(self, 'domains')
    },
    /**
     * Can use this to customize what is displayed in fileSelector's toggle box
     */
    get toggleContents(): React.ReactNode {
      return null
    },
    /**
     * Can use this to customize what the fileSelector. It takes a prop called
     * `setLocation` that should be used to set a UriLocation
     */
    get SelectorComponent(): AnyReactComponentType | undefined {
      return undefined
    },
    /**
     * Can use this to add a label to the UrlChooser. Has no effect if a custom
     * SelectorComponent is supplied
     */
    get selectorLabel(): string | undefined {
      return undefined
    },
  }))
  .views(self => ({
    /**
     * Determine whether this internetAccount provides credentials for a URL
     * @param location  - UriLocation of resource
     * @returns true or false
     */
    handlesLocation(location: UriLocation): boolean {
      return self.domains.some((domain: string) =>
        location?.uri.includes(domain),
      )
    },
    /**
     * The key used to store this internetAccount's token in sessionStorage
     */
    get tokenKey() {
      return `${self.internetAccountId}-token`
    },
  }))
  .actions(self => ({
    /**
     * Must be implemented by a model extending or composing this one. Pass the
     * user's token to `resolve`.
     * @param resolve - Pass the token to this function
     * @param reject - If there is an error getting the token, call this function
     */
    getTokenFromUser(
      resolve: (token: string) => void,
      reject: (error: Error) => void,
    ): void {
      throw new Error('getTokenFromUser must be implemented by extending model')
    },
    storeToken(token: string) {
      sessionStorage.setItem(self.tokenKey, token)
    },
    removeToken() {
      sessionStorage.removeItem(self.tokenKey)
    },
    retrieveToken() {
      return sessionStorage.getItem(self.tokenKey)
    },
    /**
     * This can be used by an internetAccount to validate a token works before
     * it is used. This is run when preAuthorizationInformation is requested, so
     * it can be used to check that a token is valid before sending it to a
     * worker thread. It expects the token to be returned so that this action
     * can also be used to generate a new token (e.g. by using a refresh token)
     * if the original one was invalid. Should throw an error if a token is
     * invalid.
     * @param token - Auth token
     * @param location - UriLocation of the resource
     * @returns - Valid auth token
     */
    async validateToken(token: string, location: UriLocation) {
      return token
    },
  }))
  .actions(self => {
    let tokenPromise: Promise<string> | undefined = undefined
    return {
      /**
       * Try to get the token from the location pre-auth, from local storage,
       * or from a previously cached promise. If token is not available, uses
       * `getTokenFromUser`.
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
        if (inWebWorker) {
          throw new Error(
            'Did not get internet account pre-authorization info in worker',
          )
        }
        token = self.retrieveToken()
        if (token) {
          tokenPromise = Promise.resolve(token)
          return tokenPromise
        }
        return new Promise(async (r, x) => {
          function resolve(token: string) {
            self.storeToken(token)
            r(token)
          }
          function reject(error: Error) {
            self.removeToken()
            x(error)
          }
          self.getTokenFromUser(resolve, reject)
        })
      },
    }
  })
  .actions(self => ({
    addAuthHeaderToInit(init: RequestInit = {}, token: string) {
      const tokenInfoString = self.tokenType
        ? `${self.tokenType} ${token}`
        : token
      const newHeaders = new Headers(init.headers || {})
      newHeaders.append(self.authHeader, tokenInfoString)
      return { ...init, headers: newHeaders }
    },
    /**
     * Gets the token and returns it along with the information needed to
     * create a new internetAccount.
     * @param location - UriLocation of the resource
     * @returns
     */
    async getPreAuthorizationInformation(location: UriLocation) {
      const authToken = await self.getToken(location)
      let validatedToken: string
      try {
        validatedToken = await self.validateToken(authToken, location)
      } catch (error) {
        self.removeToken()
        throw error
      }
      return {
        internetAccountType: self.type,
        authInfo: { token: validatedToken, configuration: getConf(self) },
      }
    },
  }))
  .actions(self => ({
    /**
     * Get a fetch method that will add any needed authentication headers to
     * the request before sending it. If location is provided, it will be
     * checked to see if it includes a token in it pre-auth information.
     * @param location - UriLocation of the resource
     * @returns A function that can be used to fetch
     */
    getFetcher(
      location?: UriLocation,
    ): (input: RequestInfo, init?: RequestInit) => Promise<Response> {
      return async (
        input: RequestInfo,
        init?: RequestInit,
      ): Promise<Response> => {
        const authToken = await self.getToken(location)
        const newInit = self.addAuthHeaderToInit(init, authToken)
        return fetch(input, newInit)
      }
    },
  }))
  .actions(self => ({
    /**
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
