import type React from 'react'
import { types } from 'mobx-state-tree'
import { BaseInternetAccountConfig } from './baseInternetAccountConfig'
import { ConfigurationReference, getConf } from '../../configuration'
import { RemoteFileWithRangeCache } from '../../util/io'
import { ElementId } from '../../util/types/mst'
import type { UriLocation, AnyReactComponentType } from '../../util/types'
import type { Instance } from 'mobx-state-tree'

const inWebWorker = typeof sessionStorage === 'undefined'

/**
 * #stateModel BaseInternetAccountModel
 * #category internetAccount
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

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
  }))
  .views(self => ({
    /**
     * #method
     * Determine whether this internetAccount provides credentials for a URL
     * @param location  - UriLocation of resource
     * @returns true or false
     */
    handlesLocation(location: UriLocation) {
      return self.domains.some(domain => location.uri.includes(domain))
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
    storeToken(token: string) {
      sessionStorage.setItem(self.tokenKey, token)
    },
    /**
     * #action
     */
    removeToken() {
      sessionStorage.removeItem(self.tokenKey)
    },
    /**
     * #action
     */
    retrieveToken() {
      return sessionStorage.getItem(self.tokenKey)
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
    return {
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
        tokenPromise = new Promise((resolve, reject) => {
          self.getTokenFromUser(
            token => {
              self.storeToken(token)
              resolve(token)
            },
            error => {
              self.removeToken()
              reject(error)
            },
          )
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
      return {
        ...init,
        headers: new Headers({
          ...init?.headers,
          ...(token
            ? {
                [self.authHeader]: self.tokenType
                  ? `${self.tokenType} ${token}`
                  : token,
              }
            : {}),
        }),
      }
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
      let validatedToken: string | undefined
      try {
        validatedToken = await self.validateToken(authToken, location)
      } catch (error) {
        self.removeToken()
        throw error
      }
      return {
        internetAccountType: self.type,
        authInfo: {
          token: validatedToken,
          configuration: getConf(self),
        },
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
      return async (input: RequestInfo, init?: RequestInit) => {
        const authToken = await self.getToken(loc)
        const newInit = self.addAuthHeaderToInit(init, authToken)
        return fetch(input, newInit)
      }
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
