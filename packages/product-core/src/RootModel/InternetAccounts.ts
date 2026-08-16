import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { asRoot } from '../siblingCast.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { UriLocation } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * The ephemeral account ids RpcManager mints are `<TypeName>-<rest>` — the
 * leading segment names the account type and the remainder is its display name.
 * Read in one place so the two callers cannot disagree about which is which.
 */
function parseEphemeralId(internetAccountId: string) {
  const [type = '', ...rest] = internetAccountId.split('-')
  return { type, name: rest.join('-') }
}

/**
 * #stateModel InternetAccountsMixin
 * #category root
 */
export function InternetAccountsRootModelMixin(pluginManager: PluginManager) {
  return types
    .model({
      /**
       * #property
       */
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
    })
    .actions(self => ({
      /**
       * #action
       */
      initializeInternetAccount(
        internetAccountConfig: AnyConfigurationModel,
        initialSnapshot: object = {},
      ) {
        self.internetAccounts.push({
          ...initialSnapshot,
          type: internetAccountConfig.type,
          configuration: internetAccountConfig,
        })
        return self.internetAccounts.at(-1)
      },

      /**
       * #action
       */
      createEphemeralInternetAccount(
        internetAccountId: string,
        initialSnapshot: Record<string, unknown>,
        url: string,
      ) {
        let hostUri: string | undefined

        try {
          const urlObj = new URL(url)
          const pathname = urlObj.pathname
          const lastSlash = pathname.lastIndexOf('/')
          const dirPath =
            lastSlash !== -1 ? pathname.slice(0, lastSlash + 1) : '/'
          hostUri = `${urlObj.origin}${dirPath}`
        } catch {
          // ignore
        }
        const { type, name } = parseEphemeralId(internetAccountId)
        const configuration = {
          type,
          internetAccountId,
          name,
          description: '',
          domains: hostUri ? [hostUri] : [],
        }
        self.internetAccounts.push({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        return self.internetAccounts.at(-1)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      findAppropriateInternetAccount(location: UriLocation) {
        // find the existing account selected from menu
        const selectedId = location.internetAccountId
        if (selectedId) {
          const selectedAccount = self.internetAccounts.find(account => {
            return account.internetAccountId === selectedId
          })
          if (selectedAccount) {
            return selectedAccount
          }
        }

        // if no existing account or not found, try to find working account
        for (const account of self.internetAccounts) {
          const handleResult = account.handlesLocation(location)
          if (handleResult) {
            return account
          }
        }

        // if still no existing account, create ephemeral config to use — but
        // only for an id whose leading segment names an account type this
        // session actually has. Anything else is a location pointing at an
        // account that is simply gone (a track from a shared session whose
        // config defined one, a config it was removed from, a host that never
        // loaded the authentication plugin), and pushing an unknown type into
        // the array threw a bare MST union error out of whatever was opening
        // the file. No account instead lets the read go out unauthenticated and
        // report the 401 it gets, which is the failure the user can act on.
        if (
          selectedId &&
          pluginManager
            .getElementTypesInGroup('internet account')
            .some(t => t.name === parseEphemeralId(selectedId).type)
        ) {
          return self.createEphemeralInternetAccount(
            selectedId,
            {},
            location.uri,
          )
        }
        return null
      },
    }))
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(
            function internetAccountsAutorun() {
              const { jbrowse } = asRoot(self)
              for (const internetAccount of jbrowse.internetAccounts) {
                if (
                  !self.internetAccounts.some(
                    a =>
                      a.internetAccountId === internetAccount.internetAccountId,
                  )
                ) {
                  self.initializeInternetAccount(internetAccount)
                }
              }
            },
            { name: 'InternetAccounts' },
          ),
        )
      },
    }))
}

export type RootModelWithInternetAccountsType = ReturnType<
  typeof InternetAccountsRootModelMixin
>
export type RootModelWithInternetAccounts =
  Instance<RootModelWithInternetAccountsType>
