import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { InternetAccount } from '@jbrowse/core/pluggableElementTypes/models'
import PluginManager from '@jbrowse/core/PluginManager'
import { OAuthInternetAccountConfigModel } from './configSchema'
import crypto from 'crypto'
import { Instance, types, getRoot } from 'mobx-state-tree'
import { searchOrReplaceInArgs } from '@jbrowse/core/util'
import { FileLocation, UriLocation } from '@jbrowse/core/util/types'
import deepEqual from 'fast-deep-equal'

// Notes go here:

// if chooser is first,
// put a menu item to open dropbox or open google drive
// similar to igv where the menu item action is that it opens the chooser
// and the user selects a file, where that file will be put into the track selector
// or maybe in the 'Add track' flow, add an option for add from dropbox/google drive
// or maybe its just part of the file selector flow (such as import form or sv inspector import form)

// make a new core plugin called authentication
// put OAuthModel file there, plugin would have implementation of Oauth, HTTPBasic, etc

interface Account {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface OAuthData {
  client_id: string
  redirect_uri: string
  response_type: 'token' | 'code'
  scope?: string
  code_challenge?: string
  code_challenge_method?: string
  token_access_type?: string
}

const stateModelFactory = (
  pluginManager: PluginManager,
  configSchema: OAuthInternetAccountConfigModel,
) => {
  return types
    .compose(
      'OAuthInternetAccount',
      InternetAccount,
      types.model({
        id: 'OAuth',
        type: types.literal('OAuthInternetAccount'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      authorizationCode: '',
      accessToken: '',
      refreshToken: '',
      codeVerifierPKCE: '',
      expireTime: 0,
      errorMessage: '',
    }))
    .views(self => ({
      get tokenType() {
        return getConf(self, 'tokenType') || 'Bearer'
      },
      handlesLocation(location: FileLocation): boolean {
        const validDomains = self.accountConfig.validDomains || []
        return validDomains.some((domain: string) =>
          (location as UriLocation)?.uri.includes(domain),
        )
      },
    }))
    .actions(self => ({
      setCodeVerifierPKCE(codeVerifier: string) {
        self.codeVerifierPKCE = codeVerifier
      },
      setErrorMessage(message: string) {
        self.errorMessage = message
      },
      async useEndpointForAuthorization() {
        const config = self.accountConfig
        const data: OAuthData = {
          client_id: config.clientId,
          redirect_uri: 'http://localhost:3000',
          response_type: config.responseType || 'code',
        }

        if (config.scopes) {
          data.scope = config.scopes
        }

        if (config.needsPKCE) {
          const base64Encode = (buf: Buffer) => {
            return buf
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=/g, '')
          }
          const codeVerifier = base64Encode(crypto.randomBytes(32))
          const sha256 = (str: string) => {
            return crypto.createHash('sha256').update(str).digest()
          }
          const codeChallenge = base64Encode(sha256(codeVerifier))
          data.code_challenge = codeChallenge
          data.code_challenge_method = 'S256'

          this.setCodeVerifierPKCE(codeVerifier)
        }

        if (config.hasRefreshToken) {
          data.token_access_type = 'offline'
        }

        const params = Object.entries(data)
          .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
          .join('&')

        const url = `${config.authEndpoint}?${params}`
        const options = `width=500,height=600,left=0,top=0`
        return window.open(
          url,
          `JBrowseAuthWindow-${self.internetAccountId}`,
          options,
        )
      },
    }))
    .actions(self => {
      let location: FileLocation | undefined = undefined
      let resolve: Function = () => {}
      let reject: Function = () => {}
      let openLocationPromise: Promise<string> | undefined = undefined
      return {
        async setAccessTokenInfo(
          token: string,
          expireTime = 0,
          generateNew = false,
        ) {
          self.accessToken = token
          self.expireTime = expireTime

          if (generateNew && token) {
            sessionStorage.setItem(`${self.internetAccountId}-token`, token)
          }

          if (!location) {
            reject()
          } else {
            let fileUrl
            try {
              fileUrl = await this.fetchFile((location as UriLocation).uri)
            } catch (error) {
              reject(new Error(error))
            }
            resolve(fileUrl)
          }
          this.deleteMessageChannel()
          location = undefined
          resolve = () => {}
          reject = () => {}
          openLocationPromise = undefined
        },
        // MODELING THE NEW CONCEPT
        // getFetcher() {
        // return a curried version of fetch
        // will have most of the logic from the original openLocation
        // modified to do oauth flows or corresponding internet account stuff
        // return (function that has same signature as core fetch)
        // return a function taht interally calls globalCacheFetch
        // }

        // openLocation(l: FileLocation){
        // returns a genericFilehandle RemoteFile
        // return RemoteFile() // one of the options is passing it a fetcher
        // can look at the genericfilehandle read me
        // https://github.com/GMOD/generic-filehandle
        // }
        // code:
        // async openLocation(location) { return new RemoteFile(location.uri, { fetch: this.getFetcher() })}

        // handleRpcMethodCall()
        // token would be looked for in the PreAuthLocation information instead of the map
        // will always call openLocation, the logic to open the flow or not will be in getFetcher
        // if you are in the worker, and no preauth information available throw new error
        // it returns the serialized location information to serializedAuthArguments
        async openLocation(l: FileLocation) {
          location = l

          if (!openLocationPromise) {
            openLocationPromise = new Promise(async (r, x) => {
              this.addMessageChannel()
              self.useEndpointForAuthorization()
              resolve = r
              reject = x
            })
          }
          return openLocationPromise
        },
        setAuthorizationCode(code: string) {
          self.authorizationCode = code
        },
        setRefreshToken(token: string) {
          const refreshTokenKey = `${self.internetAccountId}-refreshToken`
          const existingToken = localStorage.getItem(refreshTokenKey)
          if (!existingToken) {
            self.refreshToken = token
            localStorage.setItem(
              `${self.internetAccountId}-refreshToken`,
              token,
            )
          } else {
            self.refreshToken = existingToken
          }
        },
        async exchangeAuthorizationForAccessToken(token: string) {
          const config = self.accountConfig
          const data = {
            code: token,
            grant_type: 'authorization_code',
            client_id: config.clientId,
            code_verifier: self.codeVerifierPKCE,
            redirect_uri: 'http://localhost:3000',
          }

          const params = Object.entries(data)
            .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
            .join('&')

          const response = await fetch(`${config.tokenEndpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
          })

          const accessToken = await response.json()
          this.setAccessTokenInfo(
            accessToken.access_token,
            accessToken.expires_in,
            true,
          )
          if (accessToken.refresh_token) {
            this.setRefreshToken(accessToken.refresh_token)
          }
        },
        async exchangeRefreshForAccessToken() {
          const foundRefreshToken = Object.keys(localStorage).find(key => {
            return key === `${self.internetAccountId}-refreshToken`
          })
          if (foundRefreshToken) {
            const config = self.accountConfig
            const data = {
              grant_type: 'refresh_token',
              refresh_token: localStorage.getItem(foundRefreshToken),
              client_id: config.clientId,
            }

            const params = Object.entries(data)
              .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
              .join('&')

            const response = await fetch(`${config.tokenEndpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: params,
            })

            const accessToken = await response.json()
            this.setAccessTokenInfo(
              accessToken.access_token,
              accessToken.expires_in,
              true,
            )
            return accessToken
          }
        },
        async fetchFile(location: string, existingToken?: string) {
          const accessToken = existingToken ? existingToken : self.accessToken
          if (!location || !accessToken) {
            return
          }
          switch (self.origin) {
            case 'dropbox': {
              const response = await fetch(
                'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${accessToken}`, // the access token is getting cached or something here
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    url: location,
                  }),
                },
              )
              if (!response.ok) {
                const errorText = await response.text()
                throw new Error(
                  `Network response failure: ${response.status} (${errorText})`,
                )
              }
              const metadata = await response.json()
              if (metadata) {
                const fileResponse = await fetch(
                  'https://api.dropboxapi.com/2/files/get_temporary_link',
                  {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ path: metadata.id }),
                  },
                )
                if (!fileResponse.ok) {
                  const errorText = await fileResponse.text()
                  throw new Error(
                    `Network response failure: ${fileResponse.status} (${errorText})`,
                  )
                }
                const file = await fileResponse.json()
                return file.link
              }
              break
            }
            case 'google': {
              const urlId = location.match(/[-\w]{25,}/)

              const response = await fetch(
                `https://www.googleapis.com/drive/v2/files/${urlId}`,
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                },
              )

              if (!response.ok) {
                const errorText = await response.text()
                throw new Error(
                  `Network response failure: ${response.status} (${errorText})`,
                )
              }
              const fileMetadata = await response.json()
              return fileMetadata.downloadUrl
            }
          }
        },
        addMessageChannel() {
          window.addEventListener('message', this.finishOAuthWindow)
        },
        deleteMessageChannel() {
          window.removeEventListener('message', this.finishOAuthWindow)
        },
        finishOAuthWindow(event: MessageEvent) {
          if (
            event.data.name === `JBrowseAuthWindow-${self.internetAccountId}`
          ) {
            if (event.data.redirectUri.includes('access_token')) {
              const fixedQueryString = event.data.redirectUri.replace('#', '?')
              const queryStringSearch = new URL(fixedQueryString).search
              const urlParams = new URLSearchParams(queryStringSearch)
              const token = urlParams.get('access_token')
              const expireTime = urlParams.get('expires_in')
              if (!token || !expireTime) {
                self.setErrorMessage('Error fetching token')
                return reject(self.errorMessage)
              }
              this.setAccessTokenInfo(token, parseFloat(expireTime), true)
            }
            if (event.data.redirectUri.includes('code')) {
              const queryString = new URL(event.data.redirectUri).search
              const urlParams = new URLSearchParams(queryString)
              const code = urlParams.get('code')
              if (!code) {
                self.setErrorMessage('Error fetching code')
                return reject(self.errorMessage)
              }
              this.exchangeAuthorizationForAccessToken(code)
            }
            if (event.data.redirectUri.includes('access_denied')) {
              self.setErrorMessage('User cancelled OAuth flow')
              if (reject) {
                return reject(self.errorMessage)
              }
            }
          }
        },
        async handleRpcMethodCall(
          location: FileLocation,
          authenticationInfoMap: Record<string, string>,
          args: {},
          retried = false,
        ) {
          const token = authenticationInfoMap[self.internetAccountId]

          let file
          let newArgs = args
          try {
            file = !token
              ? await this.openLocation(location)
              : await this.fetchFile((location as UriLocation).uri, token)
          } catch (error) {
            const refreshedMap = await this.handleError(
              authenticationInfoMap,
              retried,
            )
            if (!retried && !deepEqual(refreshedMap, authenticationInfoMap)) {
              newArgs = await this.handleRpcMethodCall(
                location,
                refreshedMap,
                args,
                true,
              )
            } else {
              throw new Error(error)
            }
          }
          const editedArgs = JSON.parse(JSON.stringify(newArgs))
          if (file) {
            searchOrReplaceInArgs(editedArgs, 'uri', file)
          }
          return editedArgs
        },
        async handleError(
          authenticationInfoMap: Record<string, string>,
          retried = false,
        ) {
          const rootModel = getRoot(self)
          rootModel.removeFromAuthenticationMap(
            self.internetAccountId,
            authenticationInfoMap,
          )

          if (!retried) {
            await this.exchangeRefreshForAccessToken()
            authenticationInfoMap = rootModel.getAuthenticationInfoMap()
          }
          return authenticationInfoMap
        },
      }
    })
}

export default stateModelFactory
export type AlignmentsDisplayStateModel = ReturnType<typeof stateModelFactory>
export type AlignmentsDisplayModel = Instance<AlignmentsDisplayStateModel>
